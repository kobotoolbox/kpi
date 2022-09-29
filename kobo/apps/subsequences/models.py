# coding: utf-8
from django.db import models

from kobo.apps.languages.models.transcription import TranscriptionService
from kobo.apps.languages.models.translation import TranslationService
from kpi.models import Asset

from .constants import GOOGLETS, GOOGLETX
from .exceptions import SubsequenceTimeoutError
from .integrations.google.google_transcribe import GoogleTranscribeEngine
from .integrations.google.google_translate import GoogleTranslationEngine
from .tasks import handle_google_translation_operation


class SubmissionExtras(models.Model):

    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)
    submission_uuid = models.CharField(max_length=40, null=True)
    content = models.JSONField(default=dict)
    asset = models.ForeignKey(
        Asset,
        related_name='submission_extras',
        on_delete=models.CASCADE,
        null=True,
    )

    def save(self, *args, **kwargs):
        features = self.asset.advanced_features
        if 'transcript' in features:
            for qpath, vals in self.content.items():
                try:
                    autoparams = vals[GOOGLETS]
                    status = autoparams['status']
                    if status == 'requested':
                        username = self.asset.owner.username
                        engine = GoogleTranscribeEngine()
                        service = TranscriptionService.objects.get(code='goog')
                        language_code = service.get_language_code(
                            autoparams['languageCode']
                        )
                        vals[GOOGLETS] = {
                            'status': 'in_progress',
                            'languageCode': language_code,
                        }
                        for row in self.asset.content['survey']:
                            if '$qpath' in row and '$xpath' in row:
                                if row['$qpath'] == qpath:
                                    xpath = row['$xpath']
                                    break
                        try:
                            results = engine.transcribe_file(
                                asset=self.asset,
                                xpath=xpath,
                                source=language_code,
                                submission_id=self.submission_uuid,
                                user=self.asset.owner,
                            )
                        except SubsequenceTimeoutError:
                            continue
                        result_string = ' '.join(
                            [r['transcript'] for r in results]
                        )
                        vals[GOOGLETS] = {
                            'status': 'complete',
                            'value': result_string,
                            'fullResponse': results,
                            'languageCode': autoparams['languageCode'],
                        }
                    else:
                        continue
                except (KeyError, TypeError) as err:
                    continue

        if 'translated' in features:
            for key, vals in self.content.items():
                try:
                    autoparams = vals[GOOGLETX]
                    status = autoparams['status']
                    if status == 'requested':
                        content = vals['transcript']['value']
                        source_lang = vals['transcript']['languageCode']
                        target_lang = autoparams.get('languageCode')
                    elif status == 'complete':
                        content = False
                except KeyError as err:
                    content = False
                if not content:
                    continue
                tx_engine = GoogleTranslationEngine()
                # FIXME Code is hardcoded and should be dynamic
                service = TranslationService.objects.get(code='goog')
                if tx_engine.translation_must_be_async(content):
                    # must queue
                    followup_params = tx_engine.translate_async(
                        # the string to translate
                        content=content,
                        # field IDs to tell us where to save results
                        asset_uid=self.asset.uid,
                        submission_uuid=self.submission_uuid,
                        xpath=key,
                        # username is used in the label of the request
                        username=self.asset.owner.username,
                        # the rest
                        source_lang=service.get_language_code(source_lang),
                        target_lang=service.get_language_code(target_lang),
                    )
                    handle_google_translation_operation(
                        **followup_params, countdown=8
                    )
                    vals[GOOGLETX] = {
                        'status': 'in_progress',
                        'source': source_lang,
                        'languageCode': target_lang,
                    }
                else:
                    results = tx_engine.translate_sync(
                        content=content,
                        source_lang=service.get_language_code(source_lang),
                        target_lang=service.get_language_code(target_lang),
                        username=self.asset.owner.username,
                    )
                    vals[GOOGLETX] = {
                        'status': 'complete',
                        'languageCode': target_lang,
                        'value': results,
                    }
        super().save(*args, **kwargs)

    @property
    def full_content(self):
        _content = {}
        _content.update(self.content)
        _content.update({
            'timestamp': str(self.date_created),
        })
        return _content
