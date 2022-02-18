import json
from celery import shared_task

@shared_task
def queue_transcript(**params):
    from kobo.apps.subsequences.integrations.google.google_transcribe import GoogleTranscribeEngine
    asset = params['asset']
    submission_uuid = params.get('submission_uuid')
    submission_id = params.get('submission_id')
    service = params['service']
    lang_code = params['lang_code']

    engine = GoogleTranscribeEngine()

    xpath = 'path/to/question'
    submission_id = 1
    source = 'en-US'
    user = asset.owner
    transcript = engine.transcribe_file(asset, xpath, submission_id,
                                        source, user)


@shared_task
def queue_translate(asset, submission_uuid, service, lang_code):
    from kobo.apps.subsequences.integrations.google.google_translate import GoogleTranslationEngine
    engine = GoogleTranslationEngine()

    params = {'username': asset.owner.username,
              '_uuid': submission_uuid,
              'source_lang': 'en',
              'target_lang': 'af',
              'content': 'How do you say zebra in afrikaans?',
              }
    engine.translate(**params)
