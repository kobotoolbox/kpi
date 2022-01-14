# coding: utf-8
from django.contrib.auth.models import User
from rest_framework.reverse import reverse

from kpi.tests.api.v2 import test_api_users


class UserListTests(test_api_users.UserListTests):

    URL_NAMESPACE = None

    def test_current_user_extra_details_kludges(self):
        self.client.login(username='someuser', password='someuser')
        user = User.objects.get(username='someuser')
        xtradata = user.extra_details.data
        assert xtradata == {}

        # `primarySector` should be renamed to `sector`
        xtradata['primarySector'] = 'camelCase Administration'
        user.extra_details.save()
        response = self.client.get(reverse('currentuser-detail'))
        # lone string should be transformed to object with label and value
        assert response.data['extra_details']['sector'] == {
            'label': 'camelCase Administration',
            'value': 'camelCase Administration',
        }
        assert not 'primarySector' in response.data['extra_details']

        # …but only if `sector` doesn't already exist
        xtradata['sector'] = 'Head Honchoing'
        user.extra_details.save()
        response = self.client.get(reverse('currentuser-detail'))
        assert response.data['extra_details']['sector'] == {
            'label': 'Head Honchoing',
            'value': 'Head Honchoing',
        }
        assert not 'primarySector' in response.data['extra_details']

        # lone `country` string should also be transformed
        xtradata['country'] = 'KoBoLand'
        user.extra_details.save()
        response = self.client.get(reverse('currentuser-detail'))
        assert response.data['extra_details']['country'] == {
            'label': 'KoBoLand',
            'value': 'KoBoLand',
        }
