from django.db import models
from kpi.models import Asset
from django.contrib.postgres.fields import JSONField


class MockSubmission(models.Model):
    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)
    uuid = models.CharField(max_length=40, null=True)
    content = JSONField(default=dict)

    asset = models.ForeignKey(Asset, related_name='submissions',
                              on_delete=models.CASCADE, null=True)

    def run_action(self, action_instance):
        self.content = action_instance.run_change(self.content)

    def patch_content(self, content):
        '''
        placeholder functionality
        '''
        self.content.update(**content)

    @property
    def full_content(self):
        _content = {}
        _content.update(self.content)
        _content.update({
            'timestamp': str(self.date_created),
        })
        return _content
