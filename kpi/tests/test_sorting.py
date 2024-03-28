# coding: utf-8
from django.test import TestCase

from kobo.apps.kobo_auth.shortcuts import User
from kpi.utils.object_permission import get_anonymous_user


class SortingTestCase(TestCase):

    def test_different_sort_between_python_and_db(self):

        # Ensure that `AnonymousUser` is created to include it in the list below
        get_anonymous_user()

        User.objects.bulk_create([
            User(first_name='A', last_name='User', username='a_user'),
            User(first_name='Alexander', last_name='Mtembenuzeni', username='alex_Mtemb'),
            User(first_name='Another', last_name='User', username='anotheruser'),
        ])

        users = list(
            User.objects.filter(username__istartswith='a')
            .values_list('username', flat=True)
            .order_by('username')
        )

        # The database (PostgreSQL, as of Jun, 14, 2022) seems to be case
        # insensitive and treats `_` after any letters.
        # Python is case sensitive and treats `_` before any letters.
        expected_database = [
            'alex_Mtemb',
            'AnonymousUser',
            'anotheruser',
            'a_user',
        ]

        expected_python = [
            'AnonymousUser',
            'a_user',
            'alex_Mtemb',
            'anotheruser',
        ]

        self.assertEqual(users, expected_database)
        self.assertEqual(sorted(users), expected_python)
        # Obviously if the first two assertions are True, the one below should
        # be false. No matter what, let's be paranoid and test it anyway.
        self.assertNotEqual(users, sorted(users))
