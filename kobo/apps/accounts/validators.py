from django.core import validators
from django.utils.translation import gettext_lazy as t

USERNAME_REGEX = r'^[a-z][a-z0-9_]+$'
USERNAME_MAX_LENGTH = 30
USERNAME_INVALID_MESSAGE = t(
    'Usernames must be between 2 and 30 characters in length, '
    'and may only consist of lowercase letters, numbers, '
    'and underscores, where the first character must be a letter.'
)

username_validators = [
    validators.RegexValidator(USERNAME_REGEX, USERNAME_INVALID_MESSAGE),
    validators.MaxLengthValidator(USERNAME_MAX_LENGTH),
]
