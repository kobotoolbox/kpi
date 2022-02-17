from kobo.apps.subsequences.models import SubmissionExtras
from kobo.apps.subsequences.tasks.queues import (
    queue_transcript,
    queue_translate,
)

def run():
    most_recent_submission = SubmissionExtras.objects.last()

    asset = most_recent_submission.asset
    submission_uuid = most_recent_submission.uuid
    # get submission's '_id' for Transcripts
    service = 'google'
    lang = 'en_US'

    # queue_transcript(...)
    # queue_translate(...)
