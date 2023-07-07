import gzip

import regex as re
from constance import config
from django.core.exceptions import ValidationError
from django.utils.translation import gettext as t
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import (
    CommonPasswordValidator as BaseCommonPasswordValidator,
    MinimumLengthValidator as BaseMinimumLengthValidator,
    UserAttributeSimilarityValidator as BaseUserAttributeSimilarityValidator,
)

from hub.models import ConfigurationFile, ConfigurationFileSlug


class CommonPasswordValidator(BaseCommonPasswordValidator):

    def __init__(self, *args, **kwargs):
        if not config.ENABLE_COMMON_PASSWORD_VALIDATION:
            return

        self._load_password()

    def validate(self, password, user=None):
        if not config.ENABLE_COMMON_PASSWORD_VALIDATION:
            return

        # Call `_load.password()` in case `ENABLE_COMMON_PASSWORD_VALIDATION`
        # has been turned on after first instantiation of all validators.
        # List of passwords would not have been populated in that case.
        self._load_password()
        return super().validate(password, user)

    def _load_password(self):
        """
        Load passwords if they have been loaded yet
        """
        if hasattr(self, 'passwords'):
            return

        try:
            configuration_file = ConfigurationFile.objects.get(
                slug=ConfigurationFileSlug.COMMON_PASSWORDS_FILE
            )
        except ConfigurationFile.DoesNotExist:
            super().__init__(password_list_path=self.DEFAULT_PASSWORD_LIST_PATH)
        else:
            content = configuration_file.content.read()
            try:
                common_passwords_lines = gzip.decompress(content).decode().splitlines()
            except gzip.BadGzipFile:
                common_passwords_lines = content.decode().splitlines()

            self.passwords = {p.strip() for p in common_passwords_lines}


class MinimumLengthValidator(BaseMinimumLengthValidator):

    def validate(self, password, user=None):
        if not config.ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION:
            return

        # needs to set `self.min_length` here because if it is set in the
        # constructor, it won't be refresh if constance value is changed.
        self.min_length = config.MINIMUM_PASSWORD_LENGTH
        return super().validate(password, user)


class MostRecentPasswordValidator:

    def validate(self, password, user=None):
        if not config.ENABLE_MOST_RECENT_PASSWORD_VALIDATION:
            return

        if not user:
            return

        if user.check_password(password):
            raise ValidationError(
                t('You cannot use your last password.'),
                code=f'most_recent_password_error',
            )


class UserAttributeSimilarityValidator(BaseUserAttributeSimilarityValidator):

    def validate(self, password, user=None):
        if not config.ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION:
            return

        # needs to set `self.min_length` here because if it is set in the
        # constructor, it won't be refresh if constance value is changed.
        self.user_attributes = config.PASSWORD_USER_ATTRIBUTES.splitlines()

        # Set extra detail attributes on user object to call parent class
        # validation
        if not hasattr(user, 'full_name') and not hasattr(user, 'organization'):
            try:
                user_extra_details = user.extra_details
            except get_user_model().extra_details.RelatedObjectDoesNotExist:
                pass
            else:
                setattr(user, 'full_name', user_extra_details.data.get('name', ''))
                setattr(
                    user,
                    'organization',
                    user_extra_details.data.get('organization', ''),
                )

        super().validate(password, user)


class CustomRulesValidator:

    def validate(self, password, user=None):
        if not config.ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION:
            return

        custom_rules = config.PASSWORD_CUSTOM_CHARACTER_RULES.splitlines()
        threshold = config.PASSWORD_CUSTOM_CHARACTER_RULES_REQUIRED_TO_PASS
        valid_rules_count = 0
        for pattern in custom_rules:
            if re.search(pattern, password):
                valid_rules_count += 1

        if valid_rules_count < threshold:
            raise ValidationError(
                t(
                   'The password must be a combination of ##number of rules## '
                   'of the characters rules.'
                ).replace(
                    '##number of rules##', str(threshold)
                ),
                code=f'custom_rules_error',
            )
