from django.db import models
from django.contrib.postgres.fields import JSONField

from kpi.models import Asset
from kobo.apps.subsequences.constants import GOOGLETX, GOOGLETS
from kobo.apps.subsequences.integrations.google.google_translate import  (
    GoogleTranslationEngine,
)

from kobo.apps.subsequences.tasks import (
    handle_translation_operation,
)


def request_transcript(*args, **kwargs):
    from pprint import pformat
    # trigger transcript here
    with open('TMP_GOOGLE.log', 'a') as ff:
        ff.write(f'''
        Requested a transcript from google with params:
        {pformat(kwargs)}
        ''')


class SubmissionExtras(models.Model):
    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)
    uuid = models.CharField(max_length=40, null=True)
    content = JSONField(default=dict)

    asset = models.ForeignKey(Asset, related_name='submission_extras',
                              on_delete=models.CASCADE, null=True)

    def save(self):
        features = self.asset.advanced_features
        if 'transcript' in features:
            for key, vals in self.content.items():
                try:
                    autoparams = vals[GOOGLETS]
                    status = autoparams['status']
                    if status == 'requested':
                        username = self.asset.owner.username
                        request_transcript(asset_uid=self.asset.uid,
                                           user=username,
                                           submission_uuid=self.uuid,
                                           xpath=key)
                        vals[GOOGLETS] = {
                            'status': 'in_progress',
                            'languageCode': autoparams.get('languageCode'),
                        }
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
                        submission_uuid=self.uuid,
                        xpath=key,
                        # username is used in the label of the request
                        username=self.asset.owner.username,
                        # the rest
                        source_lang=source_lang,
                        target_lang=target_lang,
                    )
                    handle_translation_operation(**followup_params,
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
        super(SubmissionExtras, self).save()

    @property
    def full_content(self):
        _content = {}
        _content.update(self.content)
        _content.update({
            'timestamp': str(self.date_created),
        })
        return _content
