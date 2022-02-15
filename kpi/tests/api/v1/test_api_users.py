# coding: utf-8
from django.contrib.auth.models import User
from rest_framework.reverse import reverse

from kpi.tests.api.v2 import test_api_users


class UserListTests(test_api_users.UserListTests):

    URL_NAMESPACE = None

    def test_current_user_extra_details_kludges(self):
        endpoint = reverse(self._get_endpoint('currentuser-detail'))

        self.client.login(username='someuser', password='someuser')
        user = User.objects.get(username='someuser')
        xtradata = user.extra_details.data
        assert xtradata == {}

        # `primarySector` should be renamed to `sector`
        xtradata['primarySector'] = 'camelCase Administration'
        user.extra_details.save()
        response = self.client.get(endpoint)
        # …and non-empty lone string should be transformed to object with label
        # and value
        assert response.data['extra_details']['sector'] == {
            'label': 'camelCase Administration',
            'value': 'camelCase Administration',
        }
        assert 'primarySector' not in response.data['extra_details']

        # …but only if `sector` doesn't already exist
        xtradata['sector'] = 'Head Honchoing'
        user.extra_details.save()
        response = self.client.get(endpoint)
        assert response.data['extra_details']['sector'] == {
            'label': 'Head Honchoing',
            'value': 'Head Honchoing',
        }
        assert 'primarySector' not in response.data['extra_details']

        # non-empty lone `country` string should also be transformed
        xtradata['country'] = 'KoBoLand'
        user.extra_details.save()
        response = self.client.get(endpoint)
        assert response.data['extra_details']['country'] == {
            'label': 'KoBoLand',
            'value': 'KoBoLand',
        }

        # empty lone strings should not be transformed
        xtradata.clear()
        xtradata['country'] = ''
        xtradata['sector'] = ''
        user.extra_details.save()
        response = self.client.get(endpoint)
        assert 'label' not in response.data['extra_details']['country']
        assert 'label' not in response.data['extra_details']['sector']
