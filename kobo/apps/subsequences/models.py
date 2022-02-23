from django.db import models
from kpi.models import Asset
from django.contrib.postgres.fields import JSONField


def request_transcript(*args, **kwargs):
    # trigger transcript here
    return

def request_translation(*args, **kwargs):
    # trigger translation here
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
                    status = vals['googlets']['status']
                    if status == 'requested':
                        request_transcript(asset_uid=self.asset.uid,
                                           submission_uuid=self.uuid,
                                           xpath=key)
                        vals['googlets'] = {
                            'status': 'in_progress',
                        }
                except KeyError as err:
                    continue
        if 'translate' in features:
            for key, vals in self.content.items():
                try:
                    status = vals['googletx']['status']
                    if status == 'requested':
                        request_translation(asset_uid=self.asset.uid,
                                            submission_uuid=self.uuid,
                                            xpath=key)
                        vals['googletx'] = {
                            'status': 'in_progress',
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
