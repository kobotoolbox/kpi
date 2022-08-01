from django.db import models
from django.contrib.postgres.fields import JSONField

from kpi.models import Asset
from kobo.apps.subsequences.constants import GOOGLETX, GOOGLETS
from kobo.apps.subsequences.integrations.google.google_translate import  (
    GoogleTranslationEngine,
)
from kobo.apps.subsequences.integrations.google.google_transcribe import  (
    GoogleTranscribeEngine,
)

from kobo.apps.subsequences.tasks import (
    handle_google_translation_operation,
)

TEMP_LANGCODE_EXPANDS = {
    'en': 'en-US',
}

def _has_value(data):
    return 'value' in data and len(data['value']) > 0

def all_known_cols(content):
    modes = []
    for qpath, vals in content.items():
        if 'transcript' in vals:
            data = vals['transcript']
            if 'value' in data and _has_value(data):
                modes.append(f'{qpath}:manual_transcript')
        if GOOGLETS in vals:
            modes.append(f'{qpath}:autotranscript_google')
        if 'translated' in vals:
            langdata = vals['translated']
            for langcode, data in langdata.items():
                if _has_value(data):
                    modes.append(f'{qpath}:manual_translation:{langcode}')
        if GOOGLETX in vals:
            modes.append(f'{qpath}:autotranslate_google')
    return modes

class SubmissionExtras(models.Model):
    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)
    submission_uuid = models.CharField(max_length=40, null=True)
    content = JSONField(default=dict)

    asset = models.ForeignKey(Asset, related_name='submission_extras',
                              on_delete=models.CASCADE, null=True)

    def save(self):
        features = self.asset.advanced_features
        if 'transcript' in features:
            for qpath, vals in self.content.items():
                try:
                    autoparams = vals[GOOGLETS]
                    status = autoparams['status']
                    if status == 'requested':
                        username = self.asset.owner.username
                        engine = GoogleTranscribeEngine()
                        language_code = autoparams['languageCode']
                        if language_code in TEMP_LANGCODE_EXPANDS:
                            language_code = TEMP_LANGCODE_EXPANDS[language_code]
                        vals[GOOGLETS] = {
                            'status': 'in_progress',
                            'languageCode': language_code,
                        }
                        for row in self.asset.content['survey']:
                            if '$qpath' in row and '$xpath' in row:
                                if row['$qpath'] == qpath:
                                    xpath = row['$xpath']
                                    break
                        results = engine.transcribe_file(
                            asset=self.asset,
                            xpath=xpath,
                            source=language_code,
                            submission_id=self.submission_uuid,
                            user=self.asset.owner,
                        )
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
                except KeyError as err:
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
                        source_lang=source_lang,
                        target_lang=target_lang,
                    )
                    handle_google_translation_operation(**followup_params,
                                                 countdown=8)
                    vals[GOOGLETX] = {
                        'status': 'in_progress',
                        'source': source,
                        'languageCode': target_lang,
                    }
                else:
                    results = tx_engine.translate_sync(
                        content=content,
                        source_lang=source_lang,
                        target_lang=target_lang,
                        username=self.asset.owner.username,
                    )
                    vals[GOOGLETX] = {
                        'status': 'complete',
                        'languageCode': target_lang,
                        'value': results,
                    }
        _found = all_known_cols(self.content)
        existing_known_cols = self.asset.known_cols.get('known', [])
        self.asset.known_cols['known'] = list(set([*_found, *existing_known_cols]))
        self.asset.save()
        super(SubmissionExtras, self).save()

    @property
    def full_content(self):
        _content = {}
        _content.update(self.content)
        _content.update({
            'timestamp': str(self.date_created),
        })
        return _content
