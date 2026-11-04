"""
Import a submission's supplement from another server, versions as they are.

The supplement PATCH endpoint records new work: it runs automatic actions and stores
manual ones as accepted. Copying a project between servers (kobo-transfer) needs the
opposite: the source's versions stored unchanged, so an automatic transcript that nobody
has accepted yet arrives as an automatic transcript pending review, with its own
`_uuid`, dates and dependencies.

    POST /api/v2/assets/{uid_asset}/data/{submission_root_uuid}/supplement/import/

The body is the source's `GET .../supplement/` response. Versions are merged by `_uuid`,
so importing the same supplement again changes nothing; for a version both sides have,
acceptance and verification are kept from either side and nothing else is overwritten.
Every question and action in the body must be enabled on this asset, and the merged
supplement must pass the same result schemas as any other write.
"""

import copy

import jsonschema
from django.db import transaction
from rest_framework import serializers, status
from rest_framework.response import Response

from kobo.apps.openrosa.apps.logger.xform_instance_parser import remove_uuid_prefix
from kpi.deployment_backends.openrosa_backend import OpenRosaDeploymentBackend
from kpi.views.v2.data import DataViewSet
from .actions.base import BaseAction
from .constants import SCHEMA_VERSIONS, Action
from .models import SubmissionSupplement
from .schemas import validate_submission_supplement

VERSIONS = BaseAction.VERSION_FIELD
UUID = BaseAction.UUID_FIELD
CREATED = BaseAction.DATE_CREATED_FIELD
MODIFIED = BaseAction.DATE_MODIFIED_FIELD
ACCEPTED = BaseAction.DATE_ACCEPTED_FIELD
VERIFIED = 'verified'
DATE_VERIFIED = '_dateVerified'


def _merge_version(existing: dict, incoming: dict) -> bool:
    """
    Fold `incoming` into `existing`, the same version on two servers. Only review state
    moves: accepted or verified on either side stays so. Returns whether anything changed.
    """
    changed = False
    if incoming.get(ACCEPTED) and (
        not existing.get(ACCEPTED) or incoming[ACCEPTED] < existing[ACCEPTED]
    ):
        existing[ACCEPTED] = incoming[ACCEPTED]
        changed = True
    if incoming.get(VERIFIED):
        if not existing.get(VERIFIED):
            existing[VERIFIED] = True
            changed = True
        if incoming.get(DATE_VERIFIED) and (
            not existing.get(DATE_VERIFIED)
            or incoming[DATE_VERIFIED] < existing[DATE_VERIFIED]
        ):
            existing[DATE_VERIFIED] = incoming[DATE_VERIFIED]
            changed = True
    return changed


def _merge_node(existing: dict, incoming: dict) -> tuple[int, int]:
    """
    Merge one versioned node (`{_versions: [...], _dateCreated, _dateModified}`).
    Returns (versions added, versions updated).
    """
    by_uuid = {v[UUID]: v for v in existing.setdefault(VERSIONS, [])}
    added = updated = 0
    for version in incoming.get(VERSIONS, []):
        if mine := by_uuid.get(version[UUID]):
            updated += _merge_version(mine, version)
        else:
            existing[VERSIONS].append(copy.deepcopy(version))
            by_uuid[version[UUID]] = version
            added += 1
    # Newest first, as the actions expect
    existing[VERSIONS].sort(key=lambda v: v[CREATED], reverse=True)
    created = [d for d in (existing.get(CREATED), incoming.get(CREATED)) if d]
    modified = [d for d in (existing.get(MODIFIED), incoming.get(MODIFIED)) if d]
    if created:
        existing[CREATED] = min(created)
    if modified:
        existing[MODIFIED] = max(modified)
    return added, updated


def merge_action_data(existing: dict, incoming: dict) -> tuple[int, int]:
    """
    An action's data is either one versioned node (transcription) or versioned nodes
    keyed by language (translation) or by QA question uuid (qual).
    """
    if VERSIONS in incoming:
        return _merge_node(existing, incoming)
    added = updated = 0
    for key, node in incoming.items():
        a, u = _merge_node(existing.setdefault(key, {}), node)
        added, updated = added + a, updated + u
    return added, updated


def import_supplement(asset, submission_root_uuid: str, incoming: dict) -> dict:
    if incoming.get('_version') != SCHEMA_VERSIONS[0]:
        raise serializers.ValidationError(
            {'detail': f'Only supplements in version {SCHEMA_VERSIONS[0]} can be imported'}
        )
    enabled = {
        (f.question_xpath, f.action): f for f in asset.advanced_features_set.all()
    }
    missing = sorted(
        f'{xpath}/{action_id}'
        for xpath, actions in incoming.items()
        if xpath != '_version'
        for action_id in actions
        if (xpath, action_id) not in enabled
    )
    if missing:
        raise serializers.ValidationError(
            {'detail': 'Not enabled on this project', 'missing': missing}
        )

    added = updated = 0
    with transaction.atomic():
        supplement, _ = SubmissionSupplement.objects.select_for_update().get_or_create(
            asset=asset, submission_uuid=submission_root_uuid
        )
        content = copy.deepcopy(supplement.content)
        for xpath, actions in incoming.items():
            if xpath == '_version':
                continue
            for action_id, action_data in actions.items():
                a, u = merge_action_data(
                    content.setdefault(xpath, {}).setdefault(action_id, {}), action_data
                )
                added, updated = added + a, updated + u
        content['_version'] = SCHEMA_VERSIONS[0]
        try:
            # Each action's own result schema, as every write checks it:
            # validate_submission_supplement() doesn't reach below the question
            # (its per-question schemas are dicts of action schemas, not schemas)
            for xpath, actions in incoming.items():
                if xpath == '_version':
                    continue
                for action_id in actions:
                    enabled[(xpath, action_id)].to_action().validate_result(
                        content[xpath][action_id]
                    )
            validate_submission_supplement(asset, content)
        except jsonschema.exceptions.ValidationError as e:
            raise serializers.ValidationError(
                {'detail': 'Invalid supplement', 'error': e.message}
            )
        supplement.content = content
        supplement.save(update_fields=['content', 'date_modified'])

        # Tags on qualTags questions are tracked separately, as revise_data does
        for xpath, actions in incoming.items():
            if xpath == '_version' or Action.MANUAL_QUAL not in actions:
                continue
            params = enabled[(xpath, Action.MANUAL_QUAL)].params
            for node in actions[Action.MANUAL_QUAL].values():
                for version in node.get(VERSIONS, []):
                    SubmissionSupplement._sync_qual_tag_trackers(
                        asset, params, version.get(BaseAction.VERSION_DATA_FIELD, {})
                    )

    return {'added': added, 'updated': updated}


class SupplementImportViewSet(DataViewSet):

    def supplement_import(self, request, root_uuid, *args, **kwargs):
        submission = self._get_submission_by_id_or_root_uuid(root_uuid, request)
        root_uuid_key = OpenRosaDeploymentBackend.SUBMISSION_ROOT_UUID_XPATH
        instance_id_key = OpenRosaDeploymentBackend.SUBMISSION_CURRENT_UUID_XPATH
        submission_root_uuid = remove_uuid_prefix(
            submission.get(root_uuid_key) or submission[instance_id_key]
        )
        if not isinstance(request.data, dict):
            raise serializers.ValidationError({'detail': 'Expected a supplement object'})
        result = import_supplement(self.asset, submission_root_uuid, request.data)
        return Response(
            {
                **result,
                'supplement': SubmissionSupplement.retrieve_data(
                    self.asset, submission_root_uuid
                ),
            },
            status=status.HTTP_200_OK,
        )
