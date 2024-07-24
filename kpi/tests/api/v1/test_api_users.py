# coding: utf-8
from rest_framework.reverse import reverse

from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.api.v2 import test_api_users


class UserListTests(test_api_users.UserListTests):

    URL_NAMESPACE = None

    def test_current_user_extra_details_kludges(self):
        endpoint = reverse(self._get_endpoint('currentuser-detail'))

        self.client.login(username='someuser', password='someuser')
        user = User.objects.get(username='someuser')
        xtradata = user.extra_details.data
        assert xtradata == {'name': '', 'organization': ''}

        # `primarySector` should be renamed to `sector`
        xtradata['primarySector'] = 'camelCase Administration'
        user.extra_details.save()
        response = self.client.get(endpoint)
        assert response.data['extra_details']['sector'] == 'camelCase Administration'
        assert 'primarySector' not in response.data['extra_details']

        # …but only if `sector` doesn't already exist
        xtradata['sector'] = 'Head Honchoing'
        user.extra_details.save()
        response = self.client.get(endpoint)
        assert response.data['extra_details']['sector'] == 'Head Honchoing'
        assert 'primarySector' not in response.data['extra_details']

        # empty lone strings should not be transformed
        xtradata.clear()
        xtradata['country'] = ''
        xtradata['sector'] = ''
        user.extra_details.save()
        response = self.client.get(endpoint)
        assert 'label' not in response.data['extra_details']['country']
        assert 'label' not in response.data['extra_details']['sector']
