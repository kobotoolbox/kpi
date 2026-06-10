import jsonschema.exceptions
from django.db import IntegrityError, transaction
from rest_framework import serializers

from kobo.apps.subsequences.actions import ACTION_IDS_TO_CLASSES
from kobo.apps.openrosa.apps.logger.models import Instance
from kobo.apps.subsequences.models import (
    BulkActionItemStatus,
    BulkActionStatus,
    QuestionAdvancedFeature,
    SubmissionSupplement,
    SubsequenceBulkAction,
    SubsequenceBulkActionItem,
)


class QuestionAdvancedFeatureUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionAdvancedFeature
        fields = ['params', 'question_xpath', 'action', 'asset', 'uid']
        read_only_fields = ['question_xpath', 'action', 'asset', 'uid']

    def validate(self, attrs):
        data = super().validate(attrs)
        action = self.instance.to_action()
        try:
            action.__class__.validate_params(attrs.get('params'))
        except jsonschema.exceptions.ValidationError as ve:
            raise serializers.ValidationError(ve)
        return data

    def update(self, instance, validated_data):
        action = instance.to_action()
        action.update_params(validated_data['params'])
        instance.params = action.params
        instance.save(update_fields=['params'])
        return instance


class QuestionAdvancedFeatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionAdvancedFeature
        fields = ['question_xpath', 'action', 'params', 'uid']
        read_only_fields = ['uid']

    def create(self, validated_data):
        xpath = validated_data.get('question_xpath')
        action = validated_data.get('action')
        asset = validated_data.get('asset')
        # prevent unique_together error and give a better error message
        if QuestionAdvancedFeature.objects.filter(
            asset=asset, question_xpath=xpath, action=action
        ).exists():
            raise serializers.ValidationError('Action for this question already exists')
        return super().create(validated_data)

    def validate(self, attrs):
        data = super().validate(attrs)
        Action = ACTION_IDS_TO_CLASSES[attrs.get('action')]
        try:
            Action.validate_params(attrs.get('params'))
        except jsonschema.exceptions.ValidationError as ve:
            raise serializers.ValidationError(ve)
        return data


class BulkActionUserSerializer(serializers.Serializer):
    username = serializers.CharField()


class BulkActionSubmissionStatusSerializer(serializers.Serializer):
    uuid = serializers.CharField(source='submission_root_uuid')
    status = serializers.CharField()
    error = serializers.CharField(source='failure_error', allow_null=True)


class BulkActionResponseSerializer(serializers.ModelSerializer):
    submission_uuids = serializers.SerializerMethodField()
    submission_statuses = serializers.SerializerMethodField()
    created_by = serializers.SerializerMethodField()
    cancelled_by = serializers.SerializerMethodField()

    class Meta:
        model = SubsequenceBulkAction
        fields = [
            'uid',
            'status',
            'action_id',
            'question_xpath',
            'submission_uuids',
            'submission_statuses',
            'params',
            'progress',
            'created_by',
            'date_created',
            'date_modified',
            'cancelled_by',
        ]

    def get_submission_uuids(self, obj):
        return [item.submission_root_uuid for item in self._get_items(obj)]

    def get_submission_statuses(self, obj):
        return BulkActionSubmissionStatusSerializer(
            self._get_items(obj),
            many=True,
        ).data

    def get_created_by(self, obj):
        return {'username': obj.created_by}

    def get_cancelled_by(self, obj):
        if not obj.cancelled_by:
            return None
        return {'username': obj.cancelled_by}

    def _get_items(self, obj):
        if not hasattr(obj, '_bulk_action_items_cache'):
            obj._bulk_action_items_cache = list(obj.items.all())
        return obj._bulk_action_items_cache


class BulkActionCreateSerializer(serializers.Serializer):
    ACTION_CHOICES = (
        'automatic_google_transcription',
        'automatic_google_translation',
    )

    action_id = serializers.ChoiceField(choices=ACTION_CHOICES)
    question_xpath = serializers.CharField(max_length=2000)
    submission_uuids = serializers.ListField(
        child=serializers.CharField(),
        allow_empty=False,
    )
    params = serializers.DictField()

    def validate_submission_uuids(self, value):
        deduped = list(dict.fromkeys(value))
        if len(deduped) != len(value):
            raise serializers.ValidationError(
                'submission_uuids must not contain duplicates'
            )
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        action_id = attrs['action_id']
        params = attrs['params']
        question_xpath = attrs['question_xpath']
        submission_uuids = attrs['submission_uuids']
        asset = self.context['asset']

        if 'language' not in params:
            raise serializers.ValidationError(
                {'params': {'language': ['This field is required.']}}
            )

        self._validate_submissions_exist(asset, submission_uuids)

        skipped = self._get_existing_result_uuids(
            asset, question_xpath, action_id, params, submission_uuids
        )
        skipped |= self._get_active_bulk_conflict_uuids(
            question_xpath, action_id, params, submission_uuids
        )
        eligible = [uuid for uuid in submission_uuids if uuid not in skipped]

        if not eligible:
            raise serializers.ValidationError(
                {
                    'submission_uuids': [
                        'All submissions are already processed or currently '
                        'being processed.'
                    ]
                }
            )

        attrs['submission_uuids'] = eligible
        attrs['skipped_uuids'] = sorted(skipped)
        return attrs

    def _validate_submissions_exist(self, asset, submission_uuids):
        if not asset.has_deployment:
            raise serializers.ValidationError(
                'Bulk actions can only be created for deployed assets.'
            )
        existing = set(
            Instance.objects.filter(
                xform=asset.deployment.xform,
                root_uuid__in=submission_uuids,
            ).values_list('root_uuid', flat=True)
        )
        missing = [uuid for uuid in submission_uuids if uuid not in existing]
        if missing:
            raise serializers.ValidationError(
                {
                    'submission_uuids': [
                        f'Unknown submission UUIDs: {", ".join(missing)}'
                    ]
                }
            )

    def _get_active_bulk_conflict_uuids(
        self,
        question_xpath: str,
        action_id: str,
        params: dict,
        submission_uuids: list[str],
    ) -> set[str]:
        params_hash = SubsequenceBulkAction.make_params_hash(params)
        return set(
            SubsequenceBulkActionItem.objects.filter(
                parent__asset=self.context['asset'],
                submission_root_uuid__in=submission_uuids,
                action_id=action_id,
                question_xpath=question_xpath,
                hash=params_hash,
                status__in=[
                    BulkActionItemStatus.PENDING,
                    BulkActionItemStatus.IN_PROGRESS,
                ],
            ).values_list('submission_root_uuid', flat=True)
        )

    def _get_existing_result_uuids(
        self,
        asset,
        question_xpath: str,
        action_id: str,
        params: dict,
        submission_uuids: list[str],
    ) -> set[str]:
        supplements_by_uuid = {
            supplement.submission_uuid: supplement.content or {}
            for supplement in SubmissionSupplement.objects.filter(
                asset=asset,
                submission_uuid__in=submission_uuids,
            ).only('submission_uuid', 'content')
        }

        ineligible = set()
        for submission_uuid in submission_uuids:
            supplement = supplements_by_uuid.get(submission_uuid, {})
            question_data = supplement.get(question_xpath) or {}
            if action_id == 'automatic_google_transcription':
                if self._has_existing_transcription(question_data, params):
                    ineligible.add(submission_uuid)
            elif action_id == 'automatic_google_translation':
                if self._has_existing_translation(question_data, params):
                    ineligible.add(submission_uuid)

        return ineligible

    def _has_existing_transcription(self, question_data: dict, params: dict) -> bool:
        candidates = []
        for key in ('manual_transcription', 'automatic_google_transcription'):
            action_data = question_data.get(key) or {}
            candidates.extend(action_data.get('_versions', []))

        matching_versions = []
        for version in candidates:
            data = version.get('_data', {})
            if data.get('language') != params.get('language'):
                continue
            requested_locale = params.get('locale')
            if requested_locale and data.get('locale') != requested_locale:
                continue
            matching_versions.append(version)

        if not matching_versions:
            return False

        latest = sorted(
            matching_versions,
            key=lambda version: (
                version.get('_dateAccepted') or version.get('_dateCreated') or ''
            ),
            reverse=True,
        )[0]
        latest_data = latest.get('_data', {})
        status = latest_data.get('status')
        if status in ('deleted', 'failed'):
            return False
        return latest_data.get('value') is not None or status == 'in_progress'

    def _has_existing_translation(self, question_data: dict, params: dict) -> bool:
        language = params.get('language')
        candidate_groups = []
        for key in ('manual_translation', 'automatic_google_translation'):
            action_data = question_data.get(key) or {}
            if language in action_data:
                candidate_groups.append(action_data[language])

        matching_versions = []
        for group in candidate_groups:
            matching_versions.extend(group.get('_versions', []))

        if not matching_versions:
            return False

        latest = sorted(
            matching_versions,
            key=lambda version: (
                version.get('_dateAccepted') or version.get('_dateCreated') or ''
            ),
            reverse=True,
        )[0]
        latest_data = latest.get('_data', {})
        status = latest_data.get('status')
        if status in ('deleted', 'failed'):
            return False
        return latest_data.get('value') is not None or status == 'in_progress'

    def create(self, validated_data):
        asset = self.context['asset']
        request = self.context['request']
        try:
            with transaction.atomic():
                self._ensure_question_advanced_feature(
                    asset=asset,
                    action_id=validated_data['action_id'],
                    question_xpath=validated_data['question_xpath'],
                    params=validated_data['params'],
                )
                bulk_action = SubsequenceBulkAction.create_with_items(
                    asset=asset,
                    action_id=validated_data['action_id'],
                    question_xpath=validated_data['question_xpath'],
                    params=validated_data['params'],
                    created_by=request.user.username,
                    submission_root_uuids=validated_data['submission_uuids'],
                )
                bulk_action.start_batch()
            bulk_action.skipped_uuids = validated_data.get('skipped_uuids', [])
            return bulk_action
        except IntegrityError as err:
            raise serializers.ValidationError(
                'One or more submissions already have an active matching bulk action.'
            ) from err

    def _ensure_question_advanced_feature(
        self,
        *,
        asset,
        action_id: str,
        question_xpath: str,
        params: dict,
    ) -> None:
        """
        Ensure bulk execution can reuse the normal single-submission flow

        SubmissionSupplement.revise_data() only runs actions that are enabled
        as QuestionAdvancedFeature rows, so the bulk endpoint creates or updates
        that configuration before scheduling item jobs.
        """
        feature_params = self._get_question_advanced_feature_params(params)
        feature, created = QuestionAdvancedFeature.objects.get_or_create(
            asset=asset,
            question_xpath=question_xpath,
            action=action_id,
            defaults={'params': feature_params},
        )
        if created:
            return

        action = feature.to_action()
        action.update_params(feature_params)
        if action.params != feature.params:
            feature.params = action.params
            feature.save(update_fields=['params'])

    def _get_question_advanced_feature_params(self, params: dict) -> list[dict]:
        language = params.get('language')
        if not language:
            return []
        return [{'language': language}]


class BulkActionCancelSerializer(serializers.ModelSerializer):
    status = serializers.ChoiceField(choices=[BulkActionStatus.CANCELLED])

    class Meta:
        model = SubsequenceBulkAction
        fields = ['status']

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if 'status' not in attrs:
            raise serializers.ValidationError(
                {'status': ['This field is required.']}
            )
        if self.instance.status == BulkActionStatus.COMPLETE:
            raise serializers.ValidationError(
                {'status': ['Completed bulk actions cannot be cancelled.']}
            )
        return attrs

    def update(self, instance, validated_data):
        instance.cancel(cancelled_by=self.context['request'].user.username)
        return instance
