import gzip

import regex as re
from constance import config
from django.core.exceptions import ValidationError
from django.utils.translation import gettext as t
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

    def validate(self, password, user=None):
        if not config.ENABLE_COMMON_PASSWORD_VALIDATION:
            return

        return super().validate(password, user)


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
        if not hasattr(user, 'full_name') and user.extra_details:
            setattr(user, 'full_name', user.extra_details.data.get('name', ''))

        if not hasattr(user, 'organization') and user.extra_details:
            setattr(
                user,
                'organization',
                user.extra_details.data.get('organization', ''),
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
