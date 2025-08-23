from collections import defaultdict
from copy import deepcopy
from typing import Generator

from kobo.apps.openrosa.apps.logger.xform_instance_parser import remove_uuid_prefix
from .models import SubmissionSupplement

SUBMISSION_UUID_FIELD = 'meta/rootUuid'  # FIXME: import from elsewhere
SUPPLEMENT_KEY = '_supplementalDetails'  # leave unchanged for backwards compatibility


def stream_with_supplements(asset: 'kpi.models.Asset', submission_stream: Generator):
    # FIXME: eww, this is bad, but maybe better than one query per submission?
    # Probably need to go up a few generators and grab an entire page of
    # submissions and supplements, then yield each of those, and grab again from
    # the database only once the page is exhausted
    extras = dict(
        SubmissionSupplement.objects.filter(asset=asset).values_list('submission_uuid', 'content')
    )

    if not asset.advanced_features:
        yield from submission_stream
        return

    for submission in submission_stream:
        submission_uuid = remove_uuid_prefix(submission[SUBMISSION_UUID_FIELD])
        submission[SUPPLEMENT_KEY] = SubmissionSupplement.retrieve_data(
            asset,
            prefetched_supplement=extras.get(submission_uuid)
        )
        yield submission
