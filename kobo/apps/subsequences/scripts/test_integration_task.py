from kobo.apps.subsequences.models import SubmissionExtras
from kobo.apps.subsequences.tasks import queue_transcript, queue_translate

def run():
    most_recent_submission = SubmissionExtras.objects.last()

    asset = most_recent_submission.asset
    submission_uuid = most_recent_submission.uuid
    engine = 'google'
    lang = 'en_US'

    queue_transcript.delay(asset.uid, submission_uuid, engine, lang)
