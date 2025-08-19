# Generated on 2025-02-11 20:50
from django.conf import settings
from more_itertools import chunked

from kobo.apps.openrosa.apps.logger.models import XForm
from kobo.apps.openrosa.apps.logger.utils.instance import delete_instances


def run():
    """
    Delete all XForms that were not removed by the trash bin background task.
    """
    CHUNK_SIZE = settings.SUBMISSION_DELETION_BATCH_SIZE

    xforms = (
        XForm.all_objects.defer('xml')
        .filter(pending_delete=True, kpi_asset_uid__isnull=False)
        .iterator()
    )
    for xform_batch in chunked(xforms, CHUNK_SIZE):
        for xform in xform_batch:
            # If asset still exists, the odds are great that the project deletion
            # is still pending
            if xform.asset.pk is not None:
                continue

            submission_ids = xform.instances.values_list('pk', flat=True)
            for submission_ids_batch in chunked(submission_ids, CHUNK_SIZE):
                data = {'submission_ids': submission_ids_batch}
                delete_instances(xform, data)

            xform.delete()
