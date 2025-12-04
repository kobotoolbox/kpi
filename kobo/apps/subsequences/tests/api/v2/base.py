import uuid

from django.urls import reverse

from kobo.apps.kobo_auth.shortcuts import User
from kpi.models.asset import Asset
from kpi.tests.kpi_test_case import KpiTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class SubsequenceBaseTestCase(KpiTestCase):

    fixtures = ['test_data']
    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        user = User.objects.get(username='someuser')
        self.asset = Asset(
            owner=user,
            content={'survey': [{'type': 'audio', 'label': 'q1', 'name': 'q1'}]},
        )
        self.asset.advanced_features = {}
        self.asset.save()
        self.asset.deploy(backend='mock', active=True)
        self.asset_uid = self.asset.uid
        self.asset_url = reverse(
            self._get_endpoint('asset-detail'), args=[self.asset_uid]
        )

        uuid_ = uuid.uuid4()
        self.submission_uuid = str(uuid_)

        # add a submission
        submission_data = {
            'q1': 'answer',
            '_uuid': self.submission_uuid,
            '_submitted_by': 'someuser',
        }

        self.asset.deployment.mock_submissions([submission_data])
        self.client.force_login(user)
        self.supplement_details_url = reverse(
            self._get_endpoint('submission-supplement'),
            args=[self.asset.uid, self.submission_uuid],
        )

    def set_asset_advanced_features(self, features):
        self.asset.advanced_features = features
        self.asset.save(
            adjust_content=False,
            create_version=False,
            update_fields=['advanced_features'],
        )
