from django.db import models
from django.contrib.postgres.fields import JSONField

from kpi.models import Asset
from kobo.apps.subsequences.constants import GOOGLETX, GOOGLETS


from pprint import pformat

def request_transcript(*args, **kwargs):
    # trigger transcript here
    with open('TMP_GOOGLE.log', 'a') as ff:
        ff.write(f'''
        Requested a transcript from google with params:
        {pformat(kwargs)}
        ''')
    return

def request_translation(*args, **kwargs):
    with open('TMP_GOOGLE.log', 'a') as ff:
        ff.write(f'''
        Requested a translation from google with params:
        {pformat(kwargs)}
        ''')
    return


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
                        source = vals['transcript']['value']
                        language_code = autoparams.get('languageCode')
                        username = self.asset.owner.username
                        request_translation(asset_uid=self.asset.uid,
                                            user=username,
                                            source=source,
                                            language_code=language_code,
                                            submission_uuid=self.uuid,
                                            xpath=key)
                        vals[GOOGLETX] = {
                            'status': 'in_progress',
                            'source': source,
                            'languageCode': language_code,
                        }
                except KeyError as err:
                    continue
        super(SubmissionExtras, self).save()

    @property
    def full_content(self):
        _content = {}
        _content.update(self.content)
        _content.update({
            'timestamp': str(self.date_created),
        })
        return _content
