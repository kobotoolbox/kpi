# Only these fields can be controlled by constance.config.USER_METADATA_FIELDS
CONFIGURABLE_USER_METADATA_FIELDS = (
    'full_name',
    'organization',
    'gender',
    'sector',
    'country',
)

NON_CONFIGURABLE_USER_REGISTRATION_FIELDS = [
    'username',
    'email',
    'password1',
    'password2',
]