# coding: utf-8
from django.db import models

from kobo.apps.languages.models.transcription import TranscriptionService
from kobo.apps.languages.models.translation import TranslationService
from kobo.apps.trackers.utils import update_nlp_counter
from kpi.models import Asset
from kpi.models.abstract_models import AbstractTimeStampedModel
from kpi.utils.log import logging
from .constants import GOOGLETS, GOOGLETX, ASYNC_TRANSLATION_DELAY_INTERVAL
from .exceptions import SubsequenceTimeoutError, TranscriptionResultsNotFound
from .integrations.google.google_transcribe import GoogleTranscribeEngine
from .integrations.google.google_translate import GoogleTranslationEngine
from .tasks import handle_google_translation_operation
from .utils.determine_export_cols_with_values import (
    determine_export_cols_indiv,
)


class SubmissionExtras(AbstractTimeStampedModel):

    # FIXME: uuid on the KoboCAT logger.Instance model has max_length 249
    submission_uuid = models.CharField(max_length=40)
    content = models.JSONField(default=dict)
    asset = models.ForeignKey(
        Asset,
        related_name='submission_extras',
        on_delete=models.CASCADE,
    )

    class Meta:
        # ideally `submission_uuid` is universally unique, but its uniqueness
        # per-asset is most important
        unique_together = (('asset', 'submission_uuid'),)

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
                        language_code = autoparams.get('languageCode')
                        region_code = autoparams.get('regionCode')
                        vals[GOOGLETS] = {
                            'status': 'in_progress',
                            'languageCode': language_code,
                            'regionCode': region_code,
                        }
                        for row in self.asset.content['survey']:
                            if '$qpath' in row and '$xpath' in row:
                                if row['$qpath'] == qpath:
                                    xpath = row['$xpath']
                                    break
                        region_or_language_code = region_code or language_code
                        try:
                            results = engine.transcribe_file(
                                asset=self.asset,
                                xpath=xpath,
                                source=region_or_language_code,
                                submission_id=self.submission_uuid,
                                user=self.asset.owner,
                            )
                        except SubsequenceTimeoutError:
                            continue
                        except TranscriptionResultsNotFound:
                            logging.error(f'No transcriptions found for {xpath}')
                            result_string = ''
                            results = []
                        else:
                            result_string = ' '.join(
                                [r['transcript'] for r in results]
                            )

                        vals[GOOGLETS] = {
                            'status': 'complete',
                            'value': result_string,
                            'fullResponse': results,
                            'languageCode': language_code,
                            'regionCode': region_code,
                        }
                    else:
                        continue
                except (KeyError, TypeError) as err:
                    continue

        if 'translation' in features:
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
                update_nlp_counter(
                    'google_mt_characters',
                    len(content),
                    self.asset.owner_id,
                    self.asset.id
                )
                if tx_engine.translation_must_be_async(content):
                    # must queue
                    followup_params = tx_engine.translate_async(
                        # the string to translate
                        content=content,
                        # field IDs to tell us where to save results
                        submission_uuid=self.submission_uuid,
                        xpath=key,
                        # username is used in the label of the request
                        username=self.asset.owner.username,
                        # the rest
                        source_lang=service.get_language_code(source_lang),
                        target_lang=service.get_language_code(target_lang),
                    )
                    handle_google_translation_operation.apply_async(
                        kwargs=followup_params,
                        countdown=ASYNC_TRANSLATION_DELAY_INTERVAL,
                    )
                    # FIXME: clobbers previous translations; we want a record
                    # of what Google returned, and another async translation
                    # could be in progress
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
                    # FIXME: clobbers previous translations; we want a record
                    # of what Google returned
                    vals[GOOGLETX] = {
                        'status': 'complete',
                        'languageCode': target_lang,
                        'value': results,
                    }

        asset_changes = False
        asset_known_cols = self.asset.known_cols
        for kc in determine_export_cols_indiv(self.content):
            if kc not in asset_known_cols:
                asset_changes = True
                asset_known_cols.append(kc)

        if asset_changes:
            self.asset.known_cols = asset_known_cols
            self.asset.save(create_version=False)

        super().save(*args, **kwargs)

    @property
    def full_content(self):
        _content = {}
        _content.update(self.content)
        _content.update({
            'timestamp': str(self.date_created),
        })
        return _content
