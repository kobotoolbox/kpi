from django.test import TestCase

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.subsequences.constants import Action
from kobo.apps.subsequences.models import QuestionAdvancedAction
from kobo.apps.subsequences.utils.versioning import convert_qual_params
from kpi.models import Asset


class TestVersioning(TestCase):
    def setUp(self):
        self.owner = User.objects.create(username='asset_owner')

    def _create_asset(self):
        return Asset.objects.create(owner=self.owner, content={'survey': []})

    def test_convert_qual_params_create(self):
        asset = self._create_asset()
        qualdict = {
            'qual_survey': [
                {
                    'uuid': 'q1',
                    'xpath': '/a',
                    'type': 'qual_text',
                    'labels': {'_default': 'A1'},
                },
                {
                    'uuid': 'q2',
                    'xpath': '/a',
                    'type': 'qual_text',
                    'labels': {'_default': 'A2'},
                },
                {
                    'uuid': 'q3',
                    'xpath': '/b',
                    'type': 'qual_integer',
                    'labels': {'_default': 'B1'},
                },
            ]
        }

        created = convert_qual_params(asset, qualdict)

        # Two different xpaths will create two DB rows
        self.assertEqual(len(created), 2)
        db_objs = QuestionAdvancedAction.objects.filter(asset=asset, action=Action.QUAL)
        self.assertEqual(db_objs.count(), 2)

        qa_a = QuestionAdvancedAction.objects.get(asset=asset, question_xpath='/a')
        self.assertEqual(len(qa_a.params), 2)
        self.assertEqual({p['uuid'] for p in qa_a.params}, {'q1', 'q2'})

        qa_b = QuestionAdvancedAction.objects.get(asset=asset, question_xpath='/b')
        self.assertEqual(len(qa_b.params), 1)
        self.assertEqual(qa_b.params[0]['uuid'], 'q3')

    def test_convert_qual_params_update(self):
        asset = self._create_asset()
        # pre-create an action for xpath '/a'
        QuestionAdvancedAction.objects.create(
            asset=asset,
            action=Action.QUAL,
            question_xpath='/a',
            params=[{'uuid': 'old', 'type': 'qual_text'}],
        )

        qualdict = {
            'qual_survey': [
                {
                    'uuid': 'q1',
                    'xpath': '/a',
                    'type': 'qual_text',
                    'labels': {'_default': 'A1'},
                },
            ]
        }

        created = convert_qual_params(asset, qualdict)
        # Should return the existing object (updated)
        self.assertEqual(len(created), 1)
        self.assertEqual(
            QuestionAdvancedAction.objects.filter(
                asset=asset, action=Action.QUAL
            ).count(),
            1,
        )

        qa = QuestionAdvancedAction.objects.get(asset=asset, question_xpath='/a')
        self.assertEqual(len(qa.params), 1)
        self.assertEqual(qa.params[0]['uuid'], 'q1')

    def test_convert_qual_params_invalid(self):
        asset = self._create_asset()

        # empty dict
        res = convert_qual_params(asset, {})
        self.assertEqual(res, [])
        self.assertEqual(QuestionAdvancedAction.objects.filter(asset=asset).count(), 0)

        # malformed qual_survey
        res = convert_qual_params(asset, {'qual_survey': 'not-a-list'})
        self.assertEqual(res, [])
        self.assertEqual(QuestionAdvancedAction.objects.filter(asset=asset).count(), 0)
