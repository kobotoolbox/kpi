import gzip
import json
import re

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

    def __init__(self, *args, **kwargs):
        self.min_length = config.MINIMUM_PASSWORD_LENGTH

    def validate(self, password, user=None):
        if not config.ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION:
            return

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

    def __init__(self, *args, **kwargs):
        user_attributes = config.PASSWORD_USER_ATTRIBUTES.split('\n')
        super().__init__(
            user_attributes=user_attributes, max_similarity=0.7
        )

    def validate(self, password, user=None):
        if not config.ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION:
            return

        # Set extra detail attributes on user object to call parent class
        # validation
        setattr(user, 'full_name', user.extra_details.data.get('name', ''))
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

        custom_rules = json.loads(config.PASSWORD_CUSTOM_CHARACTER_RULES)
        threshold = config.PASSWORD_CUSTOM_CHARACTER_RULES_REQUIRED_TO_PASS
        valid_rules_count = 0
        for name, pattern in custom_rules.items():
            if re.search(pattern, password):
                valid_rules_count += 1

        if valid_rules_count < threshold:
            raise ValidationError(
                t(
                   'The password must be a combination of ##number of rules## of'
                   'the characters rules.'
                ).replace(
                    '##number of rules##', str(threshold)
                ),
                code=f'custom_rules_error',
            )
