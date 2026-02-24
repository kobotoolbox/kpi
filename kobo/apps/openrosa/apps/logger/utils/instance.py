import logging
import os
import time

from django.conf import settings
from django.db import transaction
from django.db.models.signals import post_delete, pre_delete
from django_celery_beat.models import PeriodicTask
from django_userforeignkey.request import get_current_request

from kobo.apps.audit_log.utils import SubmissionUpdate
from kobo.apps.openrosa.apps.logger.models import Attachment, Note
from kobo.apps.openrosa.apps.logger.signals import (
    nullify_exports_time_of_last_submission,
    pre_delete_attachment,
    update_xform_submission_count_delete,
)
from kobo.apps.openrosa.apps.logger.utils.counters import update_storage_counters
from kobo.apps.openrosa.apps.viewer.models import InstanceModification, ParsedInstance
from kobo.apps.openrosa.apps.viewer.signals import remove_from_mongo
from kobo.apps.trash_bin.models.attachment import AttachmentTrash
from kpi.deployment_backends.kc_access.utils import kc_transaction_atomic
from kpi.deployment_backends.kc_access.storage import default_kobocat_storage
from kpi.utils.storage import bulk_rmdir
from ..exceptions import MissingValidationStatusPayloadError
from ..models.instance import Instance
from ..models.xform import XForm
from .database_query import build_db_queries


def add_validation_status_to_instance(
    username: str, validation_status_uid: str, instance: Instance
) -> bool:
    """
    Save instance validation status if it is valid.
    To be valid, it has to belong to XForm validation statuses
    """
    success = False

    # Payload must contain validation_status property.
    if validation_status_uid:

        validation_status = get_validation_status(validation_status_uid, username)
        if validation_status:
            instance.validation_status = validation_status
            instance.save(update_fields=['validation_status', 'date_modified'])
            success = instance.parsed_instance.update_mongo(asynchronous=False)

    return success


def delete_instances(xform: XForm, request_data: dict) -> int:

    deleted_records_count = 0
    postgres_query, mongo_query = build_db_queries(xform, request_data)

    # Temporarily disconnect signals that would be fired per-Instance during
    # bulk deletion. They would each re-query XForm and update counters
    # individually, which is both slow and redundant for bulk operations.
    # The equivalent updates are applied manually below after the deletion.
    pre_delete.disconnect(pre_delete_attachment, sender=Attachment)
    pre_delete.disconnect(remove_from_mongo, sender=ParsedInstance)
    post_delete.disconnect(
        nullify_exports_time_of_last_submission,
        sender=Instance,
        dispatch_uid='nullify_exports_time_of_last_submission',
    )
    post_delete.disconnect(
        update_xform_submission_count_delete,
        sender=Instance,
        dispatch_uid='update_xform_submission_count_delete',
    )

    try:
        instance_ids = postgres_query.get('id__in')
        if not instance_ids:
            instance_ids = list(
                Instance.objects.values_list('id', flat=True).filter(
                    **postgres_query
                )
            )

        # Delete related rows bottom-up with explicit SQL DELETEs instead
        # of letting Django's Collector handle the cascade. The Collector
        # loads every related object into memory at once to resolve the
        # graph, which causes OOM kills on large projects. Each explicit
        # delete holds only that table's PKs in memory, then frees them
        # before moving on. Instance.delete() afterwards finds nothing
        # left to collect and performs a fast SQL-only delete.

        total_storage_bytes = 0
        directories_to_delete = set()

        with kc_transaction_atomic(), transaction.atomic():
            # One query: collect PKs + aggregate storage bytes before deleting.
            # all_objects is used to include soft-deleted attachments
            # (delete_status IS NOT NULL) that the default manager excludes.
            attachment_rows = list(
                Attachment.all_objects.filter(instance_id__in=instance_ids)
                .values('pk', 'media_file', 'media_file_size', 'delete_status')
            )

            # Bulk cleanup AttachmentTrash (cross-DB: KPI default DB, no FK
            # constraint) before fast-deleting Attachments.
            if attachment_rows:
                attachment_ids = []
                for attachment_row in attachment_rows:

                    # Only non-trashed attachments had their storage counted; trashed
                    # ones were already decremented when moved to the trash bin.
                    if attachment_row['delete_status'] is None:
                        total_storage_bytes += attachment_row['media_file_size'] or 0

                    attachment_ids.append(attachment_row['pk'])
                    directories_to_delete.add(
                        os.path.dirname(attachment_row['media_file'])
                    )

                att_trash_qs = AttachmentTrash.objects.filter(
                    attachment_id__in=attachment_ids
                )
                periodic_task_ids = list(
                    att_trash_qs.exclude(periodic_task_id__isnull=True)
                    .values_list('periodic_task_id', flat=True)
                )
                att_trash_qs.delete()
                if periodic_task_ids:
                    PeriodicTask.objects.filter(pk__in=periodic_task_ids).delete()

            # Fast SQL DELETE — pre_delete_attachment is disconnected above so
            # Django's Collector performs a _raw_delete with zero objects loaded
            # in RAM. Physical files are not removed here (deferred to a
            # separate task).
            Attachment.all_objects.filter(instance_id__in=instance_ids).delete()
            Note.objects.filter(instance_id__in=instance_ids).delete()
            InstanceModification.objects.filter(instance_id__in=instance_ids).delete()
            ParsedInstance.objects.filter(instance_id__in=instance_ids).delete()

            # Restrict Instance.delete() to PKs only so Django's Collector does
            # not fetch heavy xml/json fields from the instance rows themselves.
            all_count, results = (
                Instance.objects.filter(**postgres_query).only('pk').delete()
            )

            identifier = f'{Instance._meta.app_label}.Instance'
            try:
                deleted_records_count = results[identifier]
            except KeyError:
                # PostgreSQL did not delete any Instance objects. Keep going in
                # case they are still present in MongoDB.
                logging.warning('Instance objects cannot be found')

            # MongoDB is not transactional, but a failure here will propagate to the
            # caller's transaction and roll back the PostgreSQL deletions.
            ParsedInstance.bulk_delete(mongo_query)

            # Always perform updates at the end of the transaction, because it is going
            # to take a lock on the XForm and UserProfile.

            # Update storage counters once for the whole batch, replacing the
            # N individual calls that pre_delete_attachment would have made.
            if total_storage_bytes:
                update_storage_counters(xform.pk, xform.user_id, -total_storage_bytes)

            # Re-apply the disconnected signal side-effects once for the batch.
            nullify_exports_time_of_last_submission(sender=Instance, instance=xform)
            update_xform_submission_count_delete(
                sender=Instance, instance=xform, value=deleted_records_count
            )

        bulk_rmdir(directories_to_delete, default_kobocat_storage)

    finally:
        # Reconnect signals that were temporarily disabled above.
        pre_delete.connect(pre_delete_attachment, sender=Attachment)
        pre_delete.connect(remove_from_mongo, sender=ParsedInstance)
        post_delete.connect(
            nullify_exports_time_of_last_submission,
            sender=Instance,
            dispatch_uid='nullify_exports_time_of_last_submission',
        )
        post_delete.connect(
            update_xform_submission_count_delete,
            sender=Instance,
            dispatch_uid='update_xform_submission_count_delete',
        )

    return deleted_records_count


def get_validation_status(validation_status_uid: str, username: str) -> dict:
    try:
        label = settings.DEFAULT_VALIDATION_STATUSES[validation_status_uid]
    except KeyError:
        return {}

    return {
        'timestamp': int(time.time()),
        'uid': validation_status_uid,
        'by_whom': username,
        'label': label,
    }


def remove_validation_status_from_instance(instance: Instance) -> bool:
    instance.validation_status = {}
    instance.save(update_fields=['validation_status', 'date_modified'])
    return instance.parsed_instance.update_mongo(asynchronous=False)


def set_instance_validation_statuses(
    xform: XForm, request_data: dict, request_username: str
) -> int:

    try:
        new_validation_status_uid = request_data['validation_status.uid']
    except KeyError:
        raise MissingValidationStatusPayloadError

    # Create new validation_status object
    new_validation_status = get_validation_status(
        new_validation_status_uid, request_username
    )
    postgres_query, mongo_query = build_db_queries(xform, request_data)

    # Update Postgres & Mongo
    records_queryset = Instance.objects.filter(**postgres_query)
    validation_status = new_validation_status.get('label', 'None')
    if get_current_request() is not None:
        get_current_request().instances = {
            record['id']: SubmissionUpdate(
                username=record['json'].get('_submitted_by'),
                action='modify',
                status=validation_status,
                id=record['id'],
                root_uuid=record['root_uuid'],
            )
            for record in records_queryset.values('id', 'root_uuid', 'json')
        }
    updated_records_count = records_queryset.update(
        validation_status=new_validation_status
    )
    ParsedInstance.bulk_update_validation_statuses(mongo_query, new_validation_status)
    return updated_records_count
