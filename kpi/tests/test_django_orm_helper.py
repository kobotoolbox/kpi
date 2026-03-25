from __future__ import annotations

from django.test import TestCase

from hub.models import ExtraUserDetail
from kobo.apps.kobo_auth.shortcuts import User
from kpi.utils.django_orm_helper import UpdateJSONFieldAttributes


class DjangoORMHelperTestCase(TestCase):
    def setUp(self):
        # Seed a user with initial JSON data on ExtraUserDetail
        self.bob = User.objects.create_user(username='bob', password='password')
        extra = self.bob.extra_details
        extra.data['organization'] = "Bob's organization"
        extra.data['name'] = 'Bob Loblaw'
        extra.save()

    def _data(self):
        self.bob.extra_details.refresh_from_db()
        return self.bob.extra_details.data

    def test_update_property_root_level_merge_and_set(self):
        """
        Root merge with a dict preserves existing keys; scalars are set at root.
        """

        updates = {
            'country': {'code': 'CA', 'label': 'Canada'},
            'sector': 'Humanitarian',
        }
        ExtraUserDetail.objects.filter(user_id=self.bob.pk).update(
            data=UpdateJSONFieldAttributes('data', updates=updates)
        )
        data = self._data()
        assert data['organization'] == "Bob's organization"
        assert data['name'] == 'Bob Loblaw'
        assert data['country'] == {'code': 'CA', 'label': 'Canada'}
        assert data['sector'] == 'Humanitarian'

    def test_update_nested_merge_dunder_preserves_siblings(self):
        """
        Merging into a nested object keeps sibling keys intact.
        """

        # Seed nested subtree
        seed = {'profile': {'address': {'street': 'Main', 'city': 'Montréal'}}}
        ExtraUserDetail.objects.filter(user_id=self.bob.pk).update(
            data=UpdateJSONFieldAttributes('data', updates=seed)
        )

        # Merge into the same nested object (change city, add postal_code)
        patch = {'city': 'Toronto', 'postal_code': 'M5H'}
        ExtraUserDetail.objects.filter(user_id=self.bob.pk).update(
            data=UpdateJSONFieldAttributes(
                'data', path='profile__address', updates=patch
            )
        )
        data = self._data()
        assert data['profile']['address']['city'] == 'Toronto'
        assert data['profile']['address']['postal_code'] == 'M5H'
        # Sibling preserved
        assert data['profile']['address']['street'] == 'Main'

    def test_update_nested_set_scalar_creates_missing_parents(self):
        """
        Setting a scalar at a nested path creates missing parent objects.
        """

        ExtraUserDetail.objects.filter(user_id=self.bob.pk).update(
            data=UpdateJSONFieldAttributes('data', path='flags__legacy', updates=False)
        )
        data = self._data()
        assert 'flags' in data
        assert data['flags']['legacy'] is False

    def test_update_top_level_set_scalar_via_path(self):
        """
        Setting a top-level scalar via a single-key dunder path.
        """

        ExtraUserDetail.objects.filter(user_id=self.bob.pk).update(
            data=UpdateJSONFieldAttributes(
                'data', path='sector', updates='Humanitarian'
            )
        )
        data = self._data()
        assert data['sector'] == 'Humanitarian'
        assert data['organization'] == "Bob's organization"
        assert data['name'] == 'Bob Loblaw'

    def test_update_top_level_merge_via_path_single_key(self):
        """
        Merging a dict at a top-level key via a dunder path.
        """

        ExtraUserDetail.objects.filter(user_id=self.bob.pk).update(
            data=UpdateJSONFieldAttributes(
                'data', path='preferences', updates={'theme': 'dark'}
            )
        )
        data = self._data()
        assert data['preferences']['theme'] == 'dark'
        assert data['organization'] == "Bob's organization"

    def test_root_merge_does_not_clobber_existing_nested_objects(self):
        """
        Root merge of {'profile': {...}} should not overwrite other 'profile' subkeys.
        """

        # Seed content under 'profile'
        seed = {'profile': {'address': {'city': 'Montréal', 'street': 'Main'}}}
        ExtraUserDetail.objects.filter(user_id=self.bob.pk).update(
            data=UpdateJSONFieldAttributes('data', updates=seed)
        )

        # Root merge adds a sibling key under 'profile'
        root_updates = {'profile': {'bio': 'Hello, world!'}}
        ExtraUserDetail.objects.filter(user_id=self.bob.pk).update(
            data=UpdateJSONFieldAttributes('data', updates=root_updates)
        )
        data = self._data()
        assert data['profile']['bio'] == 'Hello, world!'
        assert data['profile']['address']['city'] == 'Montréal'
        assert data['profile']['address']['street'] == 'Main'

    def test_nested_set_list_value(self):
        """
        Setting a list value
        """

        ExtraUserDetail.objects.filter(user_id=self.bob.pk).update(
            data=UpdateJSONFieldAttributes('data', path='tags', updates=['a', 'b'])
        )
        data = self._data()
        assert data['tags'] == ['a', 'b']

    def test_nested_merge_overwrites_conflicting_keys_only(self):
        """
        Nested merge updates conflicting keys and keeps others.
        """
        # Seed country object
        ExtraUserDetail.objects.filter(user_id=self.bob.pk).update(
            data=UpdateJSONFieldAttributes(
                'data',
                updates={
                    'country': {
                        'code': 'CA',
                        'label': 'CanadA',
                        'postal_code': 'H0H0H0',
                    }
                },
            )
        )

        # Merge: change label, add continent; keep code and postal_code
        patch = {'label': 'Country of SantaClaus', 'continent': 'North America'}
        ExtraUserDetail.objects.filter(user_id=self.bob.pk).update(
            data=UpdateJSONFieldAttributes('data', path='country', updates=patch)
        )
        data = self._data()
        assert data['country']['code'] == 'CA'  # preserved
        assert data['country']['label'] == 'Country of SantaClaus'  # replaced
        assert data['country']['continent'] == 'North America'  # added
        assert data['country']['postal_code'] == 'H0H0H0'  # preserved

    def test_nested_merge_creates_missing_parents(self):
        """
        Merging a dict at a deep path should create all missing parents.
        """
        ExtraUserDetail.objects.filter(user_id=self.bob.pk).update(
            data=UpdateJSONFieldAttributes(
                'data',
                path='profile__contact',
                updates={'email': 'bob@example.com'},
            )
        )
        data = self._data()
        assert data['profile']['contact']['email'] == 'bob@example.com'

    def test_error_when_root_with_non_dict(self):
        """
        Root operation requires a dict; passing a non-dict should raise TypeError.
        """
        try:
            ExtraUserDetail.objects.filter(user_id=self.bob.pk).update(
                data=UpdateJSONFieldAttributes('data', updates='not-a-dict')
            )
            assert False, 'TypeError was expected but not raised'
        except TypeError:
            pass

    def test_error_invalid_dunder_path(self):
        """
        Invalid dunder path should raise ValueError.
        """
        try:
            ExtraUserDetail.objects.filter(user_id=self.bob.pk).update(
                data=UpdateJSONFieldAttributes('data', path='foo____bar', updates=1)
            )
            assert False, 'ValueError was expected but not raised'
        except ValueError:
            pass
