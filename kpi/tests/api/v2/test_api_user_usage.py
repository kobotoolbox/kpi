import json
from datetime import datetime

from django.conf import settings
from django.urls import reverse
from rest_framework import status

from kpi.deployment_backends.kc_access.shadow_models import KobocatSubmissionCounter
from kpi.models import Asset
from kpi.tests.base_test_case import BaseTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class BaseUsageTestCase(BaseTestCase):
    fixtures = ["test_data"]

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self) -> None:
        self.client.login(username="someuser", password="someuser")
        self.someuser = User.objects.get(username="someuser")
        self.anotheruser = User.objects.get(username="anotheruser")
        content_source_asset = Asset.objects.get(id=1)
        self.asset = Asset.objects.create(content=content_source_asset.content,
                                          owner=self.someuser,
                                          asset_type='survey')

        self.asset.deploy(backend='mock', active=True)
        self.asset.save()

        self.__add_submissions()

        self.asset.deployment.set_namespace(self.URL_NAMESPACE)
        self.submission_list_url = self.asset.deployment.submission_list_url
        self._deployment = self.asset.deployment

    def __add_submissions(self):
        letters = string.ascii_letters
        submissions = []
        v_uid = self.asset.latest_deployed_version.uid
        self.submissions_submitted_by_someuser = []
        self.submissions_submitted_by_unknown = []
        self.submissions_submitted_by_anotheruser = []

        for i in range(20):
            submitted_by = random.choice(['', 'someuser', 'anotheruser'])
            submission = {
                '__version__': v_uid,
                'q1': ''.join(random.choice(letters) for l in range(10)),
                'q2': ''.join(random.choice(letters) for l in range(10)),
                'meta/instanceID': f'uuid:{uuid.uuid4()}',
                '_validation_status': {
                    'by_whom': 'someuser',
                    'timestamp': int(time.time()),
                    'uid': 'validation_status_on_hold',
                    'color': '#0000ff',
                    'label': 'On Hold'
                },
                '_submitted_by': submitted_by
            }

            if submitted_by == 'someuser':
                self.submissions_submitted_by_someuser.append(submission)

            if submitted_by == '':
                self.submissions_submitted_by_unknown.append(submission)

            if submitted_by == 'anotheruser':
                self.submissions_submitted_by_anotheruser.append(submission)

            submissions.append(submission)

        self.asset.deployment.mock_submissions(submissions)
        self.submissions = submissions

