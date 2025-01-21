# Generated on 2025-16-19 11:58
from django.conf import settings
from django.core.management import call_command
from django.db import IntegrityError
from more_itertools import chunked
from taggit.models import TaggedItem

from kobo.apps.openrosa.apps.logger.models import XForm, Instance
from kpi.utils.database import use_db


def run():
    """
    Transfers all assets owned by members to their respective organizations.
    """
    CHUNK_SIZE = 2000

    with use_db(settings.OPENROSA_DB_ALIAS):
        xforms = XForm.objects.only('pk', 'id_string').exclude(
            tags__name__contains='kobo-root-uuid'
        ).iterator()
        for xform_batch in chunked(xforms, CHUNK_SIZE):
            for xform in xform_batch:
                instances = Instance.objects.only(
                    'pk', 'uuid', 'xml', 'root_uuid'
                ).filter(root_uuid__isnull=True, xform_id=xform.pk).iterator()
                error = False
                for instance_batch in chunked(instances, CHUNK_SIZE):
                    if not _process_instances_batch(xform, instance_batch):
                        error = True
                        break

                if not error:
                    xform.tags.add('kobo-root-uuid-success')

        # Clean up tags while retaining failed entries for future manual review
        TaggedItem.objects.filter(tag__name='kobo-root-uuid-success').delete()


def _process_instances_batch(
    xform: XForm, instance_batch: list[Instance], first_try=True
) -> bool:
    for instance in instance_batch:
        try:
            instance._populate_root_uuid()  # noqa
        except AssertionError as e:
            if 'root_uuid should not be empty' in str(e):
                # fallback on `uuid` to back-fill `root_uuid`
                instance.root_uuid = instance.uuid
    try:
        Instance.objects.bulk_update(
            instance_batch, fields=['root_uuid']
        )
    except IntegrityError:
        if first_try:
            call_command(
                'clean_duplicated_submissions',
                xform=xform.id_string,
            )
            # Need to reload instance_batch to get new uuids
            instance_batch = Instance.objects.only(
                'pk', 'uuid', 'xml', 'root_uuid'
            ).filter(pk__in=[instance.pk for instance in instance_batch])
            return _process_instances_batch(
                xform, instance_batch, first_try=False
            )
        else:
            xform.tags.add('kobo-root-uuid-failed')
            return False
    else:
        return True
