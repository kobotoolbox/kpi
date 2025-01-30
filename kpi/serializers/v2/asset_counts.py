import datetime

from django.utils import timezone
from rest_framework import serializers

from kpi.constants import PERM_VIEW_SUBMISSIONS, PERM_PARTIAL_SUBMISSIONS
from kpi.utils.object_permission import get_database_user


class AssetCountsSerializer(serializers.Serializer):
    daily_submission_counts = serializers.SerializerMethodField()
    total_submission_count = serializers.SerializerMethodField()

    class Meta:
        fields = ('daily_submission_counts', 'total_submission_count')

    def get_daily_submission_counts(self, asset):
        today = timezone.now().date()
        request = self.context['request']
        try:
            days = int(self.context['days'])
        except ValueError:
            raise serializers.ValidationError('`days` parameter must be an integer')
        start_date = today - datetime.timedelta(days=days)
        daily_counts = asset.deployment.get_daily_counts(
            user=request.user, timeframe=(start_date, today)
        )
        return daily_counts

    def get_total_submission_count(self, asset):
        # TODO: de-duplicate this logic with
        # AssetSerializer.get_deployment__submission_count()

        request = self.context['request']
        user = get_database_user(request.user)

        if asset.owner_id == user.id:
            return asset.deployment.submission_count

        # `has_perm` benefits from internal calls which use
        # `django_cache_request`. It won't hit DB multiple times
        if asset.has_perm(user, PERM_VIEW_SUBMISSIONS):
            return asset.deployment.submission_count

        if (
            asset.has_perm(user, PERM_PARTIAL_SUBMISSIONS)
            and asset.deployment.submission_count == 0
        ):
            return 0

        return None
