import json
import uuid

from kobo.apps.hook.models.hook import Hook
from kpi.tests.kpi_test_case import KpiTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE
from ..utils.tests.mixins import HookTestCaseMixin


class BaseHookTestCase(HookTestCaseMixin, KpiTestCase):

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.client.login(username='someuser', password='someuser')
        self.asset = self.create_asset(
            'some_asset',
            content=json.dumps(
                {
                    'survey': [
                        {'type': 'text', 'label': 'q1', 'name': 'q1'},
                        {'type': 'begin_group', 'label': 'group1', 'name': 'group1'},
                        {'type': 'text', 'label': 'q2', 'name': 'q2'},
                        {'type': 'text', 'label': 'q3', 'name': 'q3'},
                        {'type': 'end_group'},
                        {'type': 'begin_group', 'label': 'group2', 'name': 'group2'},
                        {
                            'type': 'begin_group',
                            'label': 'subgroup1',
                            'name': 'subgroup1',
                        },
                        {'type': 'text', 'label': 'q4', 'name': 'q4'},
                        {'type': 'text', 'label': 'q5', 'name': 'q5'},
                        {'type': 'text', 'label': 'q6', 'name': 'q6'},
                        {'type': 'end_group'},
                        {'type': 'end_group'},
                    ]
                }
            ),
            format='json',
        )
        self.asset.deploy(backend='mock', active=True)
        self.asset.save()
        self.hook = Hook()

    def _setup_hook_and_submission(self):
        """
        Pytest fixture to prepare hook and submission_id.
        Use with: @pytest.mark.usefixtures('setup_hook_and_submission')

        Requires setUp() to have already created self.asset.
        """

        self._add_submissions()

        # Get the submission ID
        submissions = self.asset.deployment.get_submissions(self.asset.owner)
        self.submission_id = submissions[0]['_id']

        # Create and save the hook
        self.hook = Hook.objects.create(
            asset=self.asset,
            name='Test Hook',
            endpoint='https://example.com/endpoint',
            active=True,
            export_type='json',
        )

    def _add_submissions(self):
        v_uid = self.asset.latest_deployed_version.uid
        self.submission = {
            '__version__': v_uid,
            'q1': '¿Qué tal?',
            '_uuid': str(uuid.uuid4()),
            'group1/q2': '¿Cómo está en el grupo uno la primera vez?',
            'group1/q3': '¿Cómo está en el grupo uno la segunda vez?',
            'group2/subgroup1/q4': '¿Cómo está en el subgrupo uno la primera vez?',
            'group2/subgroup1/q5': '¿Cómo está en el subgrupo uno la segunda vez?',
            'group2/subgroup1/q6': '¿Cómo está en el subgrupo uno la tercera vez?',
            'group2/subgroup11/q1': '¿Cómo está en el subgrupo once?',
        }
        self.asset.deployment.mock_submissions([self.submission])
