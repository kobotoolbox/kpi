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


class CommonPasswordValidator(BaseCommonPasswordValidator):

    def validate(self, password, user=None):
        if not config.ENABLE_COMMON_PASSWORD_VALIDATION:
            return

        return super().validate(password, user)


class MinimumLengthValidator(BaseMinimumLengthValidator):

    def __init__(self, *args, **kwargs):
        self.min_length = config.MINIMUM_PASSWORD_LENGTH

    def validate(self, password, user=None):
        config.ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION
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
            return True

        super().validate(password, user)


class CustomRulesValidator:

    def validate(self, password, user=None):
        if not config.ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION:
            return True

        custom_rules = json.loads(config.PASSWORD_CUSTOM_CHARACTER_RULES)
        threshold = config.PASSWORD_MINIMUM_CUSTOM_CHARACTER_RULES_TO_PASS
        valid_rules_count = 0
        for name, pattern in custom_rules.items():
            if re.search(pattern, password):
                valid_rules_count += 1

        if valid_rules_count < threshold:
            raise ValidationError(
                t('The password does not respect custom rules.'),
                code=f'custom_rules_error',
                params={'verbose_name': name},
            )
