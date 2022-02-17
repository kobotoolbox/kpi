import json
from celery import shared_task

from kobo.apps.subsequences.integrations.google import (
    google_transcribe,
    google_translate,
)

GoogleTranscribeEngine = google_transcribe.GoogleTranscribeEngine
GoogleTranslationEngine = google_translate.GoogleTranslationEngine


@shared_task
def queue_transcript(asset_uid, submission_uuid, service, lang_code):
    # GoogleTranscribeEngine()

    data = {'asset': asset_uid, 'submission': submission_uuid,
            'service': service, 'lang_code': lang_code,}
    with open('TLOG.txt', 'a') as ff:
        ff.write(json.dumps(data))
        ff.write('\n')


@shared_task
def queue_translate(asset_uid, submission_uuid, service, lang_code):
    # GoogleTranslationEngine

    data = {'asset': asset_uid, 'submission': submission_uuid,
            'service': service, 'lang_code': lang_code,}
    with open('TLOG.txt', 'a') as ff:
        ff.write(json.dumps(data))
        ff.write('\n')
