from __future__ import annotations

from django.conf import settings
from django.db import transaction
from django.db.models import F, Q

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import AuditLog, AuditType
from kpi.exceptions import InvalidXFormException, MissingXFormException
from kpi.models import Asset, ImportTask, SubmissionExportTask
from kpi.utils.log import logging
from kpi.utils.mongo_helper import MongoHelper
from kpi.utils.storage import rmdir


def delete_asset(request_author: settings.AUTH_USER_MODEL, asset: Asset):

    asset_id = asset.pk
    asset_uid = asset.uid
    host = settings.KOBOFORM_URL
    owner_username = asset.owner.username
    project_exports = []

    if asset.has_deployment:
        _delete_submissions(request_author, asset)
        asset.deployment.delete()
        project_exports = SubmissionExportTask.objects.filter(
            Q(data__source=f'{host}/api/v2/assets/{asset.uid}/')
            | Q(data__source=f'{host}/assets/{asset.uid}/')
        )

    with transaction.atomic():
        # Delete imports
        ImportTask.objects.filter(
            Q(data__destination=f'{host}/api/v2/assets/{asset.uid}/')
            | Q(data__destination=f'{host}/assets/{asset.uid}/')
        ).delete()
        # Delete exports (and related files on storage)
        for export in project_exports:
            export.delete()

        asset.delete()
        AuditLog.objects.create(
            app_label=asset._meta.app_label,
            model_name=asset._meta.model_name,
            object_id=asset_id,
            user=request_author,
            action=AuditAction.DELETE,
            metadata={
                'asset_uid': asset_uid,
                'asset_name': asset.name,
            },
            log_type=AuditType.ASSET_MANAGEMENT,
        )

    # Delete media files left on storage
    if asset_uid:
        rmdir(f'{owner_username}/asset_files/{asset_uid}')


def _delete_submissions(request_author: settings.AUTH_USER_MODEL, asset: 'kpi.Asset'):

    # Test if XForm is still valid
    try:
        asset.deployment.xform
    except (MissingXFormException, InvalidXFormException):
        # Submissions are lingering in MongoDB but XForm has been
        # already deleted
        xform_id_string = asset.deployment.backend_response['id_string']
        xform_uuid = asset.deployment.backend_response['uuid']
        mongo_query = {
            '$or': [
                {'_xform_id_string': xform_id_string},
                {'formhub/uuid': xform_uuid},
            ],
        }
        deleted_orphans = MongoHelper.delete_many(mongo_query)
        logging.warning(f'TrashBin: {deleted_orphans} deleted MongoDB orphans')

        return

    while True:
        audit_logs = []
        submissions = list(
            asset.deployment.get_submissions(
                asset.owner,
                fields=['_id', '_uuid'],
                limit=settings.SUBMISSION_DELETION_BATCH_SIZE,
            )
        )
        if not submissions:
            if not (
                queryset_or_false := asset.deployment.get_orphan_postgres_submissions()
            ):
                break

            # Make submissions an iterable, similar to the output of
            # `deployment.get_submissions()`.
            if not (
                submissions := queryset_or_false.annotate(
                    _id=F('pk'), _uuid=F('uuid')
                ).values('_id', '_uuid')[:settings.SUBMISSION_DELETION_BATCH_SIZE]
            ):
                break

        submission_ids = []
        for submission in submissions:
            audit_logs.append(
                AuditLog(
                    app_label='logger',
                    model_name='instance',
                    object_id=submission['_id'],
                    user=request_author,
                    user_uid=request_author.extra_details.uid,
                    metadata={
                        'asset_uid': asset.uid,
                        'uuid': submission['_uuid'],
                    },
                    action=AuditAction.DELETE,
                    log_type=AuditType.SUBMISSION_MANAGEMENT,
                )
            )

            submission_ids.append(submission['_id'])

        asset.deployment.delete_submissions(
            {'submission_ids': submission_ids, 'query': ''}, request_author
        )

        if audit_logs:
            AuditLog.objects.bulk_create(audit_logs)
