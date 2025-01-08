import logging
import time

from django.conf import settings
from django.db.models.signals import post_delete, pre_delete
from django_userforeignkey.request import get_current_request

from kobo.apps.audit_log.utils import SubmissionUpdate
from kobo.apps.openrosa.apps.logger.signals import (
    nullify_exports_time_of_last_submission,
    update_xform_submission_count_delete,
)
from kobo.apps.openrosa.apps.viewer.models.parsed_instance import ParsedInstance
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
            instance.save(update_fields=['validation_status'])
            success = instance.parsed_instance.update_mongo(asynchronous=False)

    return success


def delete_instances(xform: XForm, request_data: dict) -> int:

    deleted_records_count = 0
    postgres_query, mongo_query = build_db_queries(xform, request_data)

    # Disconnect signals to speed-up bulk deletion
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
        all_count, results = Instance.objects.filter(**postgres_query).delete()
        identifier = f'{Instance._meta.app_label}.Instance'
        try:
            deleted_records_count = results[identifier]
        except KeyError:
            # PostgreSQL did not delete any Instance objects. Keep going in case
            # they are still present in MongoDB.
            logging.warning('Instance objects cannot be found')

        ParsedInstance.bulk_delete(mongo_query)

        # Update xform like signals would do if it was as single object deletion
        nullify_exports_time_of_last_submission(sender=Instance, instance=xform)
        update_xform_submission_count_delete(
            sender=Instance, instance=xform, value=deleted_records_count
        )
    finally:
        # Pre_delete signal needs to be re-enabled for parsed instance
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
    instance.save(update_fields=['validation_status'])
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
                username=record['user__username'],
                action='modify',
                status=validation_status,
                id=record['id'],
            )
            for record in records_queryset.values('user__username', 'id')
        }
    updated_records_count = records_queryset.update(
        validation_status=new_validation_status
    )
    ParsedInstance.bulk_update_validation_statuses(mongo_query, new_validation_status)
    return updated_records_count
