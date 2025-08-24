from typing import Generator

from kobo.apps.openrosa.apps.logger.xform_instance_parser import remove_uuid_prefix
from .constants import SUPPLEMENT_KEY, SUBMISSION_UUID_FIELD
from .models import SubmissionSupplement

def stream_with_supplements(asset: 'kpi.models.Asset', submission_stream: Generator):
    if not asset.advanced_features:
        yield from submission_stream
        return

    # FIXME: eww, this is bad, but maybe better than one query per submission?
    # Probably need to go up a few generators and grab an entire page of
    # submissions and supplements, then yield each of those, and grab again from
    # the database only once the page is exhausted

    # 2025-08-24: oleger's comment: we could narrow down this query to submissions
    # only available in the page (`page` as in pagination). No need to retrieve data for
    # all submissions if we are only injecting supplement data for a portion of
    # them. Question? How we do that without consuming the mongo cursor twice?
    extras = dict(
        SubmissionSupplement.objects.filter(asset=asset).values_list(
            'submission_uuid', 'content'
        )
    )

    for submission in submission_stream:
        submission_uuid = remove_uuid_prefix(submission[SUBMISSION_UUID_FIELD])
        submission[SUPPLEMENT_KEY] = SubmissionSupplement.retrieve_data(
            asset, prefetched_supplement=extras.get(submission_uuid, {})
        )
        yield submission
