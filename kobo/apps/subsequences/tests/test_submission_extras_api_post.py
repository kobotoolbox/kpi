from copy import deepcopy

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

    def test_translation_revisions_stored_properly(self):
        self.set_asset_advanced_features({
            'translated': {
                'values': ['q1'],
                'languages': ['tx1', 'tx2'],
            }
        })
        tx_instance = next(self.asset.get_advanced_feature_instances())
        first_post = {
            'q1': {
                'translated': {
                    'tx1': {
                        'value': 'VAL1'
                    }
                }
            }
        }
        summ = tx_instance.compile_revised_record({}, edits=first_post)
        assert summ['q1']['translated']['tx1']['value'] == 'VAL1'
        assert len(summ['q1']['translated']['tx1']['revisions']) == 0
        summ1 = deepcopy(summ)
        second_post = {
            'q1': {
                'translated': {
                    'tx1': {
                        'value': 'VAL2',
                    }
                }
            }
        }


class FieldRevisionsOnlyTests(ValidateSubmissionTest):
    def setUp(self):
        ValidateSubmissionTest.setUp(self)
        self.set_asset_advanced_features({
            'translated': {
                'values': ['q1'],
                'languages': ['tx1', 'tx2'],
            }
        })
        self.txi = next(self.asset.get_advanced_feature_instances())

    def test_simplest(self):
        field = self.txi.revise_field({
            'tx1': {
                'value': 'V1',
                'revisions': [],
                'dateCreated': '1',
                'dateModified': '1',
            }
        }, {
            'tx1': {
                'value': 'V2',
            }
        })

        assert 'tx1' in field
        assert field['tx1']['value'] == 'V2'
        assert len(field['tx1']['revisions']) == 1
        assert field['tx1']['dateCreated'] == '1'
        assert 'dateCreated' not in field['tx1']['revisions'][0]
        assert 'dateModified' in field['tx1']
        assert field['tx1']['dateCreated'] == '1'

    def test_date_created_is_pulled_from_last_revision(self):
        field = self.txi.revise_field({
            'tx1': {
                'value': 'V3',
                'revisions': [
                    {'value': 'V2', 'dateModified': 'B'},
                    {'value': 'V1', 'dateModified': 'A'},
                ]
            }
        }, {
            'tx1': {
                'value': 'V4',
            }
        })
        for revision in field['tx1']['revisions']:
            assert 'revisions' not in revision
        assert field['tx1']['dateCreated'] == 'A'


    def test_second_translation_comes_in(self):
        field = self.txi.revise_field({
            'tx1': {
                'value': 'T1',
                'dateModified': 'A',
                'dateCreated': 'A',
                'revisions': []
            }
        }, {
            'tx2': {
                'value': 'T2',
            }
        })
        for tx in ['tx1', 'tx2']:
            fx = field[tx]
            assert 'dateCreated' in fx
            assert 'dateModified' in fx
            assert 'revisions' in fx
        assert field['tx1']['dateCreated'] == 'A'
