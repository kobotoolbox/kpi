import logging

from django.db.models.signals import pre_delete, post_delete
from kobo.apps.openrosa.apps.logger.models.instance import (
    Instance,
)
from kobo.apps.openrosa.apps.logger.signals import (
    nullify_exports_time_of_last_submission,
    update_xform_submission_count_delete,
)
from kobo.apps.openrosa.apps.viewer.models.parsed_instance import ParsedInstance
from kobo.apps.openrosa.apps.viewer.signals import remove_from_mongo


from .database_query import build_db_queries
from ..models.xform import XForm


def delete_instances(xform: XForm, request_data: dict) -> int:

    deleted_records_count = 0
    postgres_query, mongo_query = build_db_queries(xform, request_data)

    # Disconnect signals to speed-up bulk deletion
    pre_delete.disconnect(remove_from_mongo, sender=ParsedInstance)
    post_delete.disconnect(
        nullify_exports_time_of_last_submission, sender=Instance,
        dispatch_uid='nullify_exports_time_of_last_submission',
    )
    post_delete.disconnect(
        update_xform_submission_count_delete, sender=Instance,
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
            sender=Instance,
            instance=xform,
            value=deleted_records_count
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
