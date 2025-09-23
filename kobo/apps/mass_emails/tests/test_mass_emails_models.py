from django.db.models import QuerySet
from django.test import TestCase

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.mass_emails.models import (
    USER_QUERIES,
    MassEmailConfig,
    MassEmailQueryParam,
)


class TestMassEmailConfigModel(TestCase):

    def test_get_recipients_with_parameters(self):
        """
        Test that having a mass email config with parameters for the query function
        """

        def parameterized_function(a: int=10, b: float=15, c: str='') -> QuerySet:
            """
            This test parameterized query function obtains users with id > a, id < b,
            and where the username contains the substring c, for testing purposes
            """
            return User.objects.filter(username__contains=c, id__gt=a, id__lt=b)

        USER_QUERIES['test_parameters_function'] = parameterized_function
        email_config = MassEmailConfig.objects.create(
            name='testconfig', query='test_parameters_function'
        )
        param_a = MassEmailQueryParam.objects.create(
            name='a', value='12', email_config=email_config
        )
        param_b = MassEmailQueryParam.objects.create(
            name='b', value='17', email_config=email_config
        )
        param_c = MassEmailQueryParam.objects.create(
            name='c', value='_TEST', email_config=email_config
        )

        User.objects.create(username='user_10', id=10)
        User.objects.create(username='user_11', id=11)
        User.objects.create(username='user_12_TEST', id=12)
        User.objects.create(username='user_13_TEST', id=13)
        User.objects.create(username='user_14', id=14)
        User.objects.create(username='user_15_TEST', id=15)
        User.objects.create(username='user_16_TEST', id=16)
        User.objects.create(username='user_17_TEST', id=17)

        users_queryset = email_config.get_users_queryset()
        assert {u['id'] for u in users_queryset.values('id')} == {13, 15, 16}

        param_a.value = '1_bad_int_value'
        param_a.save()
        users_queryset = email_config.get_users_queryset()
        assert {u['id'] for u in users_queryset.values('id')} == {12, 13, 15, 16}
