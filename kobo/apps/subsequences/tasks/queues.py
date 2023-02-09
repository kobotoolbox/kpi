import json
from celery import shared_task

# note this is not currently imported from tasks/__init__.py
@shared_task
def queue_transcript(**params):
    from kobo.apps.subsequences.integrations.google.google_transcribe import GoogleTranscribeEngine
    asset_uuid = params['asset_uid']
    submission_uuid = params.get('submission_uuid')
    submission_id = params.get('submission_id')
    service = params['service']
    lang_code = params['lang_code']

    engine = GoogleTranscribeEngine()

    xpath = 'path/to/question'
    submission_id = 1
    source = 'en-US'
    # user = asset.owner
    transcript = engine.transcribe_file(asset_uuid, xpath, submission_id,
                                        source, user)
