from django.test import RequestFactory, TestCase, override_settings
from rest_framework.exceptions import AuthenticationFailed

from kobo.apps.data_collectors.authentication import (
    DataCollectorTokenAuthentication,
    DataCollectorUser,
)
from kobo.apps.data_collectors.models import DataCollector, DataCollectorGroup
from kobo.apps.kobo_auth.shortcuts import User
from kpi.constants import PERM_ADD_SUBMISSIONS, PERM_MANAGE_ASSET
from kpi.models import Asset


@override_settings(DEFAULT_DEPLOYMENT_BACKEND='mock')
class TestDataCollectorAuthentication(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.authenticator = DataCollectorTokenAuthentication()
        self.someuser = User.objects.get(username='someuser')
        self.asset = Asset.objects.filter(owner=self.someuser).first()
        self.asset.save()
        self.asset.deploy(backend='mock')

    def test_data_collector_token_authentication(self):
        request = RequestFactory().get('/')
        setattr(request, 'parser_context', {'kwargs': {'token': 'token_a'}})
        data_collector_group = DataCollectorGroup.objects.create(
            name='DCG', owner=self.someuser
        )
        data_collector_group.assets.add(self.asset)
        DataCollector.objects.create(
            name='DC_a', token='token_a', group=data_collector_group
        )
        authenticated_user, token = self.authenticator.authenticate(request)
        assert isinstance(authenticated_user, DataCollectorUser)
        assert authenticated_user.assets == [self.asset.uid]

    def test_data_collector_user_permissions(self):
        user = DataCollectorUser()
        user.assets = [self.asset.uid]
        xform = self.asset.deployment.xform

        second_asset = Asset.objects.filter(owner=self.someuser)[1]
        # deploy it so we get an xform
        second_asset.save()
        second_asset.deploy(backend='mock')

        assert user.has_perm(PERM_ADD_SUBMISSIONS, xform)
        # user should only have add submission permission
        assert not user.has_perm(PERM_MANAGE_ASSET, xform)
        # no permission for an asset not in the asset list
        assert not user.has_perm(PERM_ADD_SUBMISSIONS, second_asset.deployment.xform)

    def test_bad_data_collector_token(self):
        request = RequestFactory().get('/')
        setattr(request, 'parser_context', {'kwargs': {'token': 'this_is_a_bad_token'}})
        data_collector_group = DataCollectorGroup.objects.create(
            name='DCG', owner=self.someuser
        )
        data_collector_group.assets.add(self.asset)
        DataCollector.objects.create(
            name='DC_a', token='token_a', group=data_collector_group
        )
        with self.assertRaises(AuthenticationFailed):
            self.authenticator.authenticate(request)
