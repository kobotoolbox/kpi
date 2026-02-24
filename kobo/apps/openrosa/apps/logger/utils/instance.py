import logging
import time

from django.conf import settings
from django.db.models.signals import post_delete, pre_delete
from django_userforeignkey.request import get_current_request

from kobo.apps.audit_log.utils import SubmissionUpdate
from kobo.apps.openrosa.apps.logger.models import Attachment, Note
from kobo.apps.openrosa.apps.logger.signals import (
    nullify_exports_time_of_last_submission,
    update_xform_submission_count_delete,
)
from kobo.apps.openrosa.apps.viewer.models import InstanceModification, ParsedInstance
from kobo.apps.openrosa.apps.viewer.signals import remove_from_mongo
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
        # Delete Postgres & Mongo
        instance_ids = postgres_query.get('id__in')
        if instance_ids:
            # Delete related rows bottom-up with explicit SQL DELETEs instead of
            # letting Django's Collector handle the cascade. The Collector loads
            # every related object into memory at once to resolve the graph,
            # which causes OOM kills on large projects. Each explicit delete
            # holds only that table's PKs in memory, then frees them before
            # moving on. Instance.delete() afterwards finds nothing left to
            # collect and performs a fast SQL-only delete.
            # Note: pre_delete_attachment is kept connected to update storage
            # counters and remove physical files for each Attachment.
            Attachment.objects.filter(instance_id__in=instance_ids).delete()
            Note.objects.filter(instance_id__in=instance_ids).delete()
            InstanceModification.objects.filter(instance_id__in=instance_ids).delete()
            ParsedInstance.objects.filter(instance_id__in=instance_ids).delete()

        # Restrict Instance.delete() to PKs only so Django's Collector does not
        # fetch heavy xml/json fields from the instance rows themselves.
        all_count, results = Instance.objects.filter(**postgres_query).only('pk').delete()

        identifier = f'{Instance._meta.app_label}.Instance'
        try:
            deleted_records_count = results[identifier]
        except KeyError:
            # PostgreSQL did not delete any Instance objects. Keep going in case
            # they are still present in MongoDB.
            logging.warning('Instance objects cannot be found')

        ParsedInstance.bulk_delete(mongo_query)

        # Re-apply the disconnected signal side-effects once for the whole batch.
        nullify_exports_time_of_last_submission(sender=Instance, instance=xform)
        update_xform_submission_count_delete(
            sender=Instance, instance=xform, value=deleted_records_count
        )
    finally:
        # Reconnect signals that were temporarily disabled above.
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
