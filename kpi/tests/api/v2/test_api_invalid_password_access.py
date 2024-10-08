import base64
import uuid

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.reverse import reverse

from kobo.apps.hook.models import Hook, HookLog
from kpi.models import Asset
from kpi.tests.base_test_case import BaseTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class InvalidPasswordAccessAPITestCase(BaseTestCase):

    fixtures = ['test_data']

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.asset = Asset.objects.get(id=1)
        self.asset.save()  # Create version
        self.asset.deploy(backend='mock', active=True)
        v_uid = self.asset.latest_deployed_version.uid
        uuid_ = uuid.uuid4()
        self.submission = {
            '_id': 1,
            '__version__': v_uid,
            'q1': 'abcdef',
            'q2': 'qazwsx',
            'meta/instanceID': f'uuid:{uuid_}',
            '_uuid': str(uuid_),
            '_submitted_by': 'someuser'
        }
        self.asset.deployment.mock_submissions([self.submission])
        self.hook = Hook.objects.create(asset=self.asset)
        self.hook_log = HookLog.objects.create(hook=self.hook)
        self.client.login(username='someuser', password='someuser')
        self.user = get_user_model().objects.get(username='someuser')
        self.user_token, _ = Token.objects.get_or_create(user=self.user)

    @override_settings(STRIPE_ENABLED=False)
    def test_access_forbidden_with_invalid_password(self):
        # Ensure password is valid first
        self.user.extra_details.validated_password = True
        self.user.extra_details.save()

        # someuser is able to access (main) endpoints
        self._access_endpoints(access_granted=True)

        # Flag someuser's password as not trusted
        self.user.extra_details.validated_password = False
        self.user.extra_details.save()

        # Access denied to API endpoints with not validated password - Session auth
        self._access_endpoints(access_granted=False)

        # Access denied to API endpoints with not validated password - Basic auth
        self.client.logout()
        headers = {
            'HTTP_AUTHORIZATION': 'Basic '
            + base64.b64encode(b'someuser:someuser').decode('ascii')
        }
        self._access_endpoints(access_granted=False, headers=headers)

        # Access denied to API endpoints with not validated password - Token auth
        headers = {
            'HTTP_AUTHORIZATION': f'Token {self.user_token}'
        }
        self._access_endpoints(access_granted=False, headers=headers)

    def _access_endpoints(self, access_granted: bool, headers: dict = {}):
        """
        Validate if requests return expected status code.

        The list of endpoints is not exhaustive but should cover the main ones.
        - /api/v2/assets/
        - /api/v2/assets/<uid>
        - /api/v2/assets/<uid>/data/
        - /api/v2/assets/<uid>/hooks/
        - /api/v2/assets/<uid>/hooks/<hook_uid>/logs/
        - /api/v2/assets/<uid>/hook-signal/
        - /api/v2/assets/<uid>/exports/
        - /me/
        - /environment/
        """
        status_code = (
            status.HTTP_200_OK if access_granted else status.HTTP_403_FORBIDDEN
        )
        submission_id = self.submission['_id']  # == 1

        # List of assets
        response = self.client.get(
            reverse(
                self._get_endpoint('asset-list'),
                kwargs={'format': 'json'},
            ),
            **headers,
        )
        assert response.status_code == status_code

        # Asset detail
        response = self.client.get(
            reverse(
                self._get_endpoint('asset-detail'),
                kwargs={'format': 'json', 'uid': self.asset.uid},
            ),
            **headers,
        )
        assert response.status_code == status_code

        # List of submissions
        response = self.client.get(
            reverse(
                self._get_endpoint('submission-list'),
                kwargs={'format': 'json', 'parent_lookup_asset': self.asset.uid},
            ),
            **headers,
        )
        assert response.status_code == status_code

        # Submission detail
        response = self.client.get(
            reverse(
                self._get_endpoint('submission-detail'),
                kwargs={
                    'format': 'json',
                    'parent_lookup_asset': self.asset.uid,
                    'pk': submission_id,
                },
            ),
            **headers,
        )
        assert response.status_code == status_code

        # List of Rest Services
        response = self.client.get(
            reverse(
                self._get_endpoint('hook-list'),
                kwargs={
                    'format': 'json',
                    'parent_lookup_asset': self.asset.uid,
                },
            ),
            **headers,
        )
        assert response.status_code == status_code

        # List of logs of Rest Services #1
        response = self.client.get(
            reverse(
                self._get_endpoint('hook-log-list'),
                kwargs={
                    'format': 'json',
                    'parent_lookup_asset': self.asset.uid,
                    'parent_lookup_hook': self.hook.uid,
                },
            ),
            **headers,
        )
        assert response.status_code == status_code

        # List of exports
        response = self.client.get(
            reverse(
                self._get_endpoint('asset-export-list'),
                kwargs={
                    'format': 'json',
                    'parent_lookup_asset': self.asset.uid,
                },
            ),
            **headers,
        )
        assert response.status_code == status_code

        # Endpoints below should return a 200 regardless of the user's password
        # state

        # `/me`
        response = self.client.get(reverse('currentuser-detail'), **headers)
        assert response.status_code == status.HTTP_200_OK

        # `/environment`
        response = self.client.get(reverse('environment'), **headers)
        assert response.status_code == status.HTTP_200_OK
