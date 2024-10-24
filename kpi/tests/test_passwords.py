from __future__ import annotations

from typing import Union

from constance.test import override_config
from django.contrib.auth.password_validation import get_default_password_validators
from django.core.exceptions import ValidationError

from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.base_test_case import BaseTestCase


class PasswordTestCase(BaseTestCase):

    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.get(username='someuser')
        extra_details = self.user.extra_details
        extra_details.data['name'] = 'SpongeBob'
        extra_details.save()

    @override_config(
        ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION=True,
        MINIMUM_PASSWORD_LENGTH=3,
        ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION=False,
        ENABLE_COMMON_PASSWORD_VALIDATION=False,
        ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION=False,
        ENABLE_MOST_RECENT_PASSWORD_VALIDATION=False
    )
    def test_minimum_length_failed(self):
        password = 'ab'
        error = self._run_validation(password)
        assert 'This password is too short' in error

    @override_config(
        ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION=True,
        MINIMUM_PASSWORD_LENGTH=3,
        ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION=False,
        ENABLE_COMMON_PASSWORD_VALIDATION=False,
        ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION=False,
        ENABLE_MOST_RECENT_PASSWORD_VALIDATION=False
    )
    def test_minimum_length_success(self):
        password = 'abc'
        error = self._run_validation(password)
        assert error is False

    @override_config(
        ENABLE_COMMON_PASSWORD_VALIDATION=True,
        ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION=False,
        ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION=False,
        ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION=False,
        ENABLE_MOST_RECENT_PASSWORD_VALIDATION=False
    )
    def test_common_password_failed(self):
        password = '123456'
        error = self._run_validation(password)
        assert 'This password is too common' in error

    @override_config(
        ENABLE_COMMON_PASSWORD_VALIDATION=True,
        ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION=False,
        ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION=False,
        ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION=False,
        ENABLE_MOST_RECENT_PASSWORD_VALIDATION=False
    )
    def test_common_password_success(self):
        password = 'r@nd0mP4s$word'
        error = self._run_validation(password)
        assert error is False

    @override_config(
        ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION=False,
        ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION=False,
        ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION=False,
        ENABLE_MOST_RECENT_PASSWORD_VALIDATION=False
    )
    def test_common_password_toggle_with_validators_already_loaded(self):
        """
        Ensure `CommonPasswordValidator` does not raise
        `AttributeError: 'CommonPasswordValidator' object has no attribute 'passwords'`
        if `ENABLE_COMMON_PASSWORD_VALIDATION` is turned on after first
        instantiation of all validators.
        """

        password = 'r@nd0mP4s$word'

        @override_config(ENABLE_COMMON_PASSWORD_VALIDATION=False)
        def disable_common_password_validation():
            error = self._run_validation(password)
            assert error is False

        @override_config(ENABLE_COMMON_PASSWORD_VALIDATION=True)
        def enable_common_password_validation():
            error = self._run_validation(password, void_cache=False)
            assert error is False

        disable_common_password_validation()
        enable_common_password_validation()

    @override_config(
        ENABLE_MOST_RECENT_PASSWORD_VALIDATION=True,
        ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION=False,
        ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION=False,
        ENABLE_COMMON_PASSWORD_VALIDATION=False,
        ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION=False,
    )
    def test_most_recent_password_failed(self):
        password = 'someuser'
        error = self._run_validation(password)
        assert 'You cannot reuse your last password' in error

    @override_config(
        ENABLE_MOST_RECENT_PASSWORD_VALIDATION=True,
        ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION=False,
        ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION=False,
        ENABLE_COMMON_PASSWORD_VALIDATION=False,
        ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION=False,
    )
    def test_most_recent_password_success(self):
        password = 'a_new_password'
        error = self._run_validation(password)
        assert error is False

    @override_config(
        ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION=True,
        PASSWORD_CUSTOM_CHARACTER_RULES_REQUIRED_TO_PASS=3,
        ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION=False,
        ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION=False,
        ENABLE_COMMON_PASSWORD_VALIDATION=False,
        ENABLE_MOST_RECENT_PASSWORD_VALIDATION=False
    )
    def test_custom_character_rules_failed(self):
        password = 'aAaa'
        error = self._run_validation(password)
        assert (
            'The password must contain at least 3 different kinds of characters'
            in error
        )

    @override_config(
        ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION=True,
        PASSWORD_CUSTOM_CHARACTER_RULES_REQUIRED_TO_PASS=3,
        ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION=False,
        ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION=False,
        ENABLE_COMMON_PASSWORD_VALIDATION=False,
        ENABLE_MOST_RECENT_PASSWORD_VALIDATION=False
    )
    def test_custom_character_rules_success(self):
        password = 'aAa2'
        error = self._run_validation(password)
        assert error is False

    @override_config(
        ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION=True,
        PASSWORD_USER_ATTRIBUTES='\n'.join(['username', 'full_name', 'email']),
        ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION=False,
        ENABLE_COMMON_PASSWORD_VALIDATION=False,
        ENABLE_MOST_RECENT_PASSWORD_VALIDATION=False,
        ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION=False,
    )
    def test_user_attribute_similarity_failed(self):

        password = 'someuser'
        error = self._run_validation(password)
        assert 'The password is too similar to the username' in error

        password = 'spongy bob'
        error = self._run_validation(password)
        assert 'The password is too similar to the full name' in error

        password = 'some@username.com'
        error = self._run_validation(password)
        assert 'The password is too similar to the email' in error

    @override_config(
        ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION=True,
        PASSWORD_USER_ATTRIBUTES='\n'.join(['username', 'full_name', 'email', 'organization']),
        ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION=False,
        ENABLE_COMMON_PASSWORD_VALIDATION=False,
        ENABLE_MOST_RECENT_PASSWORD_VALIDATION=False,
        ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION=False,
    )
    def test_new_user_attribute_similarity_failed(self):

        new_user = User(username='new_user', email='jd_2023@example.org')
        new_user.full_name = 'John Doe'
        new_user.organization_name = 'Unknown business inc.'

        password = 'newuser'
        error = self._run_validation(password, new_user)
        assert 'The password is too similar to the username' in error

        password = 'johnnydoe'
        error = self._run_validation(password, new_user)
        assert 'The password is too similar to the full name' in error

        password = 'jd_2023'
        error = self._run_validation(password, new_user)
        assert 'The password is too similar to the email' in error

        password = 'unkn0wnBus1ness'
        error = self._run_validation(password, new_user)
        assert 'The password is too similar to the organization name' in error

    @override_config(
        ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION=True,
        PASSWORD_USER_ATTRIBUTES='\n'.join(['username', 'full_name', 'email']),
        ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION=False,
        ENABLE_COMMON_PASSWORD_VALIDATION=False,
        ENABLE_MOST_RECENT_PASSWORD_VALIDATION=False,
        ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION=False,
    )
    def test_user_attribute_similarity_success(self):
        password = 'a_new_password'
        error = self._run_validation(password)
        assert error is False

    def _run_validation(
        self, password: str, user: User = None, void_cache: bool = True
    ) -> Union[str, bool]:

        if not user:
            user = self.user

        if void_cache:
            # Void validators cache to be sure they are instantiated again
            get_default_password_validators.cache_clear()

        for password_validator in get_default_password_validators():
            try:
                password_validator.validate(password, user)
            except ValidationError as e:
                return str(e)

        return False
