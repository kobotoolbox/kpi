from jsonschema import validate

from django.contrib.auth.models import User
from rest_framework.test import APITestCase, APIClient

from kpi.models import Asset

from .test_submission_extras_content import sample_asset

TRANSLATED = 'translated'


class ValidateSubmissionTest(APITestCase):
    def setUp(self):
        user = User(username='someuser', email='user@example.com')
        user.set_password('someuser')
        user.save()

        asset = sample_asset(advanced_features={})
        asset.owner = user
        asset.save()
        self.asset_uid = asset.uid
        self.asset_url = f'/api/v2/assets/{asset.uid}/?format=json'
        self.asset = Asset.objects.get(uid=asset.uid)
        self.client = APIClient()
        self.client.login(username='someuser', password='someuser')

    def set_asset_advanced_features(self, features):
        self.asset.advanced_features = features
        self.asset.save()
        self.asset = Asset.objects.get(uid=self.asset.uid)

    def test_asset_post_submission_extra_with_transcript(self):
        self.set_asset_advanced_features({'transcript': {'values': ['q1']}})
        resp = self.client.get(self.asset_url)
        schema = resp.json()['advanced_submission_schema']
        package = {'submission': 'abc123-def456'}
        package['q1'] = {
            'transcript': {
                'value': 'they said hello',
            },
        }

        validate(package, schema)
        rr = self.client.post(schema['url'], package, format='json')

        package['q1']['transcript'] = {'value': 'they said goodbye'}
        validate(package, schema)
        rr = self.client.post(schema['url'], package, format='json')
        q1transcript = rr.json()['q1']['transcript']
        assert q1transcript['value'] == 'they said goodbye'

    def test_asset_post_submission_extra_with_translation(self):
        self.set_asset_advanced_features({'translated': {'values': ['q1'],
            'languages': ['tx1', 'tx2']}})
        resp = self.client.get(self.asset_url)
        sub_uuid = 'abc123-def456'
        schema = resp.json()['advanced_submission_schema']
        package = {'submission': sub_uuid}
        package['q1'] = {
            'translated': {
                'tx1': {'value': 'v1'},
            }
        }
        validate(package, schema)
        rr = self.client.post(schema['url'], package, format='json')
        q1translation = rr.json()['q1']['translated']
        assert q1translation['tx1']['value'] == 'v1'
        # change the value, POST the package to the endpoint
        package['q1']['translated']['tx1'] = {'value': 'v2'}
        validate(package, schema)
        rr = self.client.post(schema['url'], package, format='json')
        q1translation = rr.json()['q1']['translated']
        subm = self.asset.submission_extras.get(uuid=sub_uuid)
        assert subm.content['q1']['translated']['tx1']['value'] == 'v2'
        assert q1translation['tx1']['value'] == 'v2'
