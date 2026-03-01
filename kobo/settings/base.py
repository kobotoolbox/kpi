import logging
import os
import string
import subprocess
import warnings
from datetime import timedelta
from mimetypes import add_type
from urllib.parse import quote_plus

import django.conf.locale
import environ
from celery.schedules import crontab
from django.conf import global_settings
from django.urls import reverse_lazy
from django.utils.translation import get_language_info
from django.utils.translation import gettext_lazy as t
from pymongo import MongoClient

from kpi.constants import PERM_DELETE_ASSET, PERM_MANAGE_ASSET
from kpi.utils.json import LazyJSONSerializable
from ..static_lists import EXTRA_LANG_INFO, SECTOR_CHOICE_DEFAULTS

env = environ.Env()

# Build paths inside the project like this: os.path.join(BASE_DIR, ...)
settings_dirname = os.path.dirname(os.path.abspath(__file__))
parent_dirname = os.path.dirname(settings_dirname)
BASE_DIR = os.path.abspath(os.path.dirname(parent_dirname))


# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env.str('DJANGO_SECRET_KEY', '@25)**hc^rjaiagb4#&q*84hr*uscsxwr-cv#0joiwj$))obyk')

# Optionally treat proxied connections as secure.
# See: https://docs.djangoproject.com/en/1.8/ref/settings/#secure-proxy-ssl-header.
# Example environment: `export SECURE_PROXY_SSL_HEADER='HTTP_X_FORWARDED_PROTO, https'`.
# SECURITY WARNING: If enabled, outer web server must filter out the `X-Forwarded-Proto` header.
SECURE_PROXY_SSL_HEADER = env.tuple('SECURE_PROXY_SSL_HEADER', str, None)

public_request_scheme = env.str('PUBLIC_REQUEST_SCHEME', 'https').lower()

if public_request_scheme == 'https' or SECURE_PROXY_SSL_HEADER:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

# These HSTS settings are sometimes overriden via nginx like in the `kobo-helm-chart`
# repository or by the AWS ALB/Azure app gateway. If you see the header returned
# with other values, check these places first
SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool('SECURE_HSTS_INCLUDE_SUBDOMAINS', False)
SECURE_HSTS_PRELOAD = env.bool('SECURE_HSTS_PRELOAD', False)
SECURE_HSTS_SECONDS = env.int('SECURE_HSTS_SECONDS', 0)

# Make Django use NginX $host. Useful when running with ./manage.py runserver_plus
# It avoids adding the debugger webserver port (i.e. `:8000`) at the end of urls.
USE_X_FORWARDED_HOST = env.bool('USE_X_FORWARDED_HOST', False)

# Domain must not exclude KoBoCAT when sharing sessions
SESSION_COOKIE_DOMAIN = env.str('SESSION_COOKIE_DOMAIN', None)
if SESSION_COOKIE_DOMAIN:
    SESSION_COOKIE_NAME = env.str('SESSION_COOKIE_NAME', 'kobonaut')
    # The trusted CSRF origins must encompass Enketo's subdomain. See
    # https://docs.djangoproject.com/en/2.2/ref/settings/#std:setting-CSRF_TRUSTED_ORIGINS
    trusted_domains = [
        f'{public_request_scheme}://*{SESSION_COOKIE_DOMAIN}',
    ]
    CSRF_TRUSTED_ORIGINS = trusted_domains
ENKETO_CSRF_COOKIE_NAME = env.str('ENKETO_CSRF_COOKIE_NAME', '__csrf')

# Limit sessions to 1 week (the default is 2 weeks)
SESSION_COOKIE_AGE = env.int('DJANGO_SESSION_COOKIE_AGE', 604800)

# Set language cookie age to same value as session cookie
LANGUAGE_COOKIE_AGE = SESSION_COOKIE_AGE

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env.bool('DJANGO_DEBUG', False)

ALLOWED_HOSTS = env.str('DJANGO_ALLOWED_HOSTS', '*').split(' ')

LOGIN_REDIRECT_URL = 'kpi-root'
LOGOUT_REDIRECT_URL = 'kobo_login'  # Use URL pattern instead of hard-coded value

# Application definition

# The order of INSTALLED_APPS is important for template resolution. When two
# apps both define templates for the same view, the first app listed receives
# precedence
INSTALLED_APPS = (
    # Always put `contenttypes` before `auth`; see
    # https://code.djangoproject.com/ticket/10827
    'django.contrib.contenttypes',
    'django.contrib.admin',
    'kobo.apps.kobo_auth.KoboAuthAppConfig',
    'django.contrib.auth',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django_prometheus',
    'reversion',
    'private_storage',
    'kobo.apps.KpiConfig',
    'kobo.apps.accounts',
    'kobo.apps.accounts.mfa.apps.MfaAppConfig',
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'allauth.socialaccount.providers.microsoft',
    'allauth.socialaccount.providers.openid_connect',
    'allauth.usersessions',
    'allauth.mfa',
    'hub.HubAppConfig',
    'import_export',
    'import_export_celery',
    'loginas',
    'webpack_loader',
    'django_extensions',
    'django_filters',
    'taggit',
    'rest_framework',
    'rest_framework.authtoken',
    'oauth2_provider',
    'django_digest',
    'kobo.apps.organizations',
    'kobo.apps.kobo_scim.apps.KoboScimConfig',
    'kobo.apps.superuser_stats.SuperuserStatsAppConfig',
    'kobo.apps.service_health',
    'kobo.apps.subsequences',
    'constance',
    'kobo.apps.hook.apps.HookAppConfig',
    'django_celery_beat',
    'corsheaders',
    'kobo.apps.external_integrations.ExternalIntegrationsAppConfig',
    'markdownx',
    'kobo.apps.help',
    'trench',
    'kobo.apps.project_views.apps.ProjectViewAppConfig',
    'kobo.apps.languages.apps.LanguageAppConfig',
    'kobo.apps.audit_log.AuditLogAppConfig',
    'kobo.apps.data_collectors.DataCollectorsConfig',
    'kobo.apps.mass_emails.MassEmailsConfig',
    'kobo.apps.trackers.TrackersConfig',
    'kobo.apps.trash_bin.TrashBinAppConfig',
    'kobo.apps.markdownx_uploader.MarkdownxUploaderAppConfig',
    'kobo.apps.form_disclaimer.FormDisclaimerAppConfig',
    'kobo.apps.openrosa.apps.logger.app.LoggerAppConfig',
    'kobo.apps.openrosa.apps.viewer.app.ViewerConfig',
    'kobo.apps.openrosa.apps.main.app.MainConfig',
    'kobo.apps.openrosa.apps.api',
    'kobo.apps.openrosa.apps.apps.OpenRosaAppConfig',
    'kobo.apps.openrosa.libs',
    'kobo.apps.project_ownership.app.ProjectOwnershipAppConfig',
    'kobo.apps.long_running_migrations.app.LongRunningMigrationAppConfig',
    'kobo.apps.user_reports.apps.UserReportsConfig',
    'drf_spectacular',
)

MIDDLEWARE = [
    'kobo.apps.service_health.middleware.HealthCheckMiddleware',
    'kobo.apps.openrosa.koboform.redirect_middleware.ConditionalRedirects',
    'django_dont_vary_on.middleware.RemoveUnneededVaryHeadersMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'hub.middleware.LocaleMiddleware',
    'allauth.account.middleware.AccountMiddleware',
    'allauth.usersessions.middleware.UserSessionsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'kobo.apps.audit_log.middleware.create_project_history_log_middleware',
    # Still needed really?
    'kobo.apps.openrosa.libs.utils.middleware.LocaleMiddlewareWithTweaks',
    'django.middleware.csrf.CsrfViewMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'kobo.apps.openrosa.libs.utils.middleware.RestrictedAccessMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'kobo.apps.openrosa.libs.utils.middleware.HTTPResponseNotAllowedMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'hub.middleware.UsernameInResponseHeaderMiddleware',
    'django_userforeignkey.middleware.UserForeignKeyMiddleware',
    'django_request_cache.middleware.RequestCacheMiddleware',
    'author.middlewares.AuthorDefaultBackendMiddleware',
    'hub.middleware.V1AccessLoggingMiddleware',
]


if os.environ.get('DEFAULT_FROM_EMAIL'):
    DEFAULT_FROM_EMAIL = env.str('DEFAULT_FROM_EMAIL')
    SERVER_EMAIL = DEFAULT_FROM_EMAIL

# Configuration options that superusers can modify in the Django admin
# interface. Please note that it's not as simple as moving a setting into the
# `CONSTANCE_CONFIG` dictionary: each place where the setting's value is needed
# must use `constance.config.THE_SETTING` instead of
# `django.conf.settings.THE_SETTING`

CONSTANCE_CONFIG = {
    'REGISTRATION_OPEN': (
        True,
        'Allow new users to register accounts for themselves',
    ),
    'REGISTRATION_ALLOWED_EMAIL_DOMAINS': (
        '',
        'Email domains allowed to register new accounts, one per line, '
        'or blank to allow all email domains'
    ),
    'REGISTRATION_DOMAIN_NOT_ALLOWED_ERROR_MESSAGE': (
        'This email domain is not allowed to create an account',
        'Error message for emails not listed in REGISTRATION_ALLOWED_EMAIL_DOMAINS '
        'if field is not blank'
    ),
    'REGISTRATION_BLACKLIST_EMAIL_DOMAINS': (
        '',
        'Email domains to block from registering new accounts, one per line, '
        'or blank to allow all email domains'
    ),
    'REGISTRATION_BLACKLIST_ERROR_MESSAGE': (
        'Account creation restricted for this server. Your organization uses a '
        'separate private KoboToolbox server. Please contact your organization '
        'support team for assistance.',
        'Error message for emails blacklisted in REGISTRATION_BLACKLIST_EMAIL_DOMAINS '
        'if field is not blank'
    ),
    'TERMS_OF_SERVICE_URL': ('', 'URL for terms of service document'),
    'PRIVACY_POLICY_URL': ('', 'URL for privacy policy'),
    'SOURCE_CODE_URL': (
        'https://github.com/kobotoolbox/',
        'URL of source code repository. When empty, a link will not be shown '
        'in the user interface',
    ),
    'SUPPORT_EMAIL': (
        env.str('KOBO_SUPPORT_EMAIL', env.str('DEFAULT_FROM_EMAIL', 'help@kobotoolbox.org')),
        'Email address for users to contact, e.g. when they encounter '
        'unhandled errors in the application',
    ),
    'SUPPORT_URL': (
        env.str('KOBO_SUPPORT_URL', 'https://support.kobotoolbox.org/'),
        'URL for "KoboToolbox Help Center"',
    ),
    'ACADEMY_URL': (
        env.str('KOBO_ACADEMY_URL', 'https://academy.kobotoolbox.org/'),
        'URL for "KoboToolbox Community Forum"',
    ),
    'COMMUNITY_URL': (
        env.str(
            'KOBO_COMMUNITY_URL', 'https://community.kobotoolbox.org/'
        ),
        'URL for "KoboToolbox Community Forum"',
    ),
    'SYNCHRONOUS_EXPORT_CACHE_MAX_AGE': (
        300,
        (
            'A synchronous export request will return the last export generated '
            'with the same settings unless it is older than this value (seconds)'
        ),
        'positive_int',
    ),
    'ALLOW_UNSECURED_HOOK_ENDPOINTS': (
        True,
        'Allow the use of unsecured endpoints for hooks. '
        '(e.g http://hook.example.com)',
    ),
    'HOOK_MAX_RETRIES': (
        3,
        'Number of times the system will retry to send data to remote server '
        'before giving up',
    ),
    'SSRF_ALLOWED_IP_ADDRESS': (
        '',
        'Whitelisted IP addresses to bypass SSRF protection\nOne per line',
    ),
    'SSRF_DENIED_IP_ADDRESS': (
        '',
        'Blacklisted IP addresses to bypass SSRF protection\nOne per line',
    ),
    'EXPOSE_GIT_REV': (
        False,
        'Display information about the running commit to non-superusers',
    ),
    'FRONTEND_MIN_RETRY_TIME': (
        2,
        'Minimum number of seconds the front end waits before retrying a '
        'failed request to the back end',
        int,
    ),
    'FRONTEND_MAX_RETRY_TIME': (
        120,
        'Maximum number of seconds the front end waits before retrying a '
        'failed request to the back end',
        int,
    ),
    'MFA_ISSUER_NAME': (
        'KoboToolbox',
        'Issuer name displayed in multi-factor applications'
    ),
    'MFA_ENABLED': (
        True,
        'Enable two-factor authentication'
    ),
    'MFA_LOCALIZED_HELP_TEXT': (
        LazyJSONSerializable({
            'default': t(
                'If you cannot access your authenticator app, please enter one '
                'of your backup codes instead. If you cannot access those '
                'either, then you will need to request assistance by '
                'contacting [##support email##](mailto:##support email##).'
            ),
            'some-other-language': (
                'This will never appear because `some-other-language` is not '
                'a valid language code, but this entry is here to show you '
                'an example of adding another message in a different language.'
            )
        }),
        (
            'Guidance message presented when users click the '
            '"Problems with the token" link.\n\n'
            '`##support email##` is a placeholder for the `SUPPORT_EMAIL` '
            'setting.\n'
            'Markdown syntax is supported.\n'
            'The “default” message will be used if no translations are provided.'
            ' The “default” should be in English.\n'
            'To add messages in other languages, follow the example of '
            '“some-other-language“, but replace “some-other-language“ with a '
            'valid language code (e.g. “fr“ for French).'

        ),
        # Use custom field for schema validation
        'i18n_text_jsonfield_schema'
    ),
    'SUPERUSER_AUTH_ENFORCEMENT': (
        False,
        'Require MFA for superusers with a usable password',
    ),
    'USAGE_LIMIT_ENFORCEMENT': (
        env.bool('USAGE_LIMIT_ENFORCEMENT', False),
        'For Stripe-enabled instances, determines whether usage limits will be enforced'
        'by blocking submissions/NLP actions or deleting stored files.',
    ),
    'ASR_MT_INVITEE_USERNAMES': (
        '',
        'List of invited usernames, one per line, who will have access to NLP '
        'ASR/MT processing via external (costly) APIs.\nEnter * to invite '
        'all users.'
    ),
    'ASR_MT_GOOGLE_REQUEST_TIMEOUT': (
        10,
        (
            'Timeout in seconds for google NLP data processing requests using'
            ' the operations API. '
        )
    ),
    'ASR_MT_GOOGLE_PROJECT_ID': (
        'kobo-asr-mt',
        'ID of the Google Cloud project used to access ASR/MT APIs',
    ),
    'ASR_MT_GOOGLE_STORAGE_BUCKET_PREFIX': (
        'kobo-asr-mt-tmp',
        (
            'Prefix for temporary ASR/MT files stored on Google Cloud. Useful'
            ' for lifecycle rules: files under this prefix can be deleted after'
            ' one day.\nThe bucket name itself is set by the environment'
            ' variable `GS_BUCKET_NAME`.'
        ),
    ),
    'ASR_MT_GOOGLE_TRANSLATION_LOCATION': (
        'us-central1',
        (
            'Google Cloud location to use for large translation tasks. It'
            ' cannot be `global`, and Google only allows certain locations.'
        ),
    ),
    'ASR_MT_GOOGLE_CREDENTIALS': (
        '',
        'The JSON content of a private key file generated by the Google Cloud '
        'IAM & Admin console.\nLeave blank to use a different Google '
        'authentication mechanism.'
    ),
    'USER_METADATA_FIELDS': (
        LazyJSONSerializable([
            {'name': 'name', 'required': True},
            {'name': 'organization', 'required': False},
            {'name': 'organization_type', 'required': False},
            {'name': 'organization_website', 'required': False},
            {'name': 'sector', 'required': False},
            {'name': 'bio', 'required': False},
            {'name': 'city', 'required': False},
            {'name': 'country', 'required': False},
            {'name': 'twitter', 'required': False},
            {'name': 'linkedin', 'required': False},
            {'name': 'instagram', 'required': False},
            {'name': 'newsletter_subscription', 'required': False},
        ]),
        # The available fields are hard-coded in the front end
        'Display (and optionally require) these metadata fields for users.\n'
        "Possible fields are:\n"
        "'organization', 'organization_type', 'organization_website', 'sector', 'gender', 'bio', "
        "'city', 'country', 'twitter', 'linkedin', 'instagram', and 'newsletter_subscription'.\n\n"
        'To add another language, follow the example below.\n\n'
        '{"name": "name", "required": False, "label": '
        '{"default": "Full Name", "fr": "Nom Complet"}}\n'
        "'default' is a required field within the 'label' dict, but 'label' is optional.",
        # Use custom field for schema validation
        'long_metadata_fields_jsonschema'
    ),
    'PROJECT_METADATA_FIELDS': (
        LazyJSONSerializable([
            {'name': 'sector', 'required': False},
            {'name': 'country', 'required': False},
            {'name': 'description', 'required': False},
        ]),
        # The available fields are hard-coded in the front end
        'Display (and optionally require) these metadata fields for projects.\n'
        "Possible fields are:\n"
        "'sector', 'country', 'operational_purpose', 'collects_pii', "
        "and 'description'\n\n"
        'To add another language, follow the example below.\n\n'
        '{"name": "sector", "required": False, "label": '
        '{"default": "Sector", "fr": "Secteur"}}\n'
        "'default' is a required field within the 'label' dict, but 'label' is optional.",
        # Use custom field for schema validation
        'metadata_fields_jsonschema'
    ),
    'SECTOR_CHOICES': (
        '\n'.join(s[0] for s in SECTOR_CHOICE_DEFAULTS),
        "Options available for the 'sector' metadata field, one per line.",
        'long_textfield'
    ),
    'OPERATIONAL_PURPOSE_CHOICES': (
        '',
        "Options available for the 'operational purpose of data' metadata "
        'field, one per line.'
    ),
    'ORGANIZATION_INVITE_EXPIRY': (
        14,
        'Number of days before organization invites expire.',
        'positive_int',
    ),
    'ASSET_SNAPSHOT_DAYS_RETENTION': (
        30,
        'Number of days to keep asset snapshots',
        'positive_int'
    ),
    'IMPORT_TASK_DAYS_RETENTION': (
        90,
        'Number of days to keep import tasks',
        'positive_int',
    ),
    'SUBMISSION_HISTORY_RETENTION': (
        180,
        'Number of days to keep submission history',
        'positive_int',
    ),
    'PROJECT_TRASH_RETENTION': (
        7,
        'Number of days to keep projects in trash after users (soft-)deleted '
        'them and before automatically hard-deleting them by the system',
        'positive_int',
    ),
    'ACCOUNT_TRASH_RETENTION': (
        30 * 6,
        'Number of days to keep deactivated accounts in trash before '
        'automatically hard-deleting all their projects and data.\n'
        'Use -1 to require a superuser to empty the trash manually instead of '
        'having the system empty it automatically.',
        'positive_int_minus_one',
    ),
    'ATTACHMENT_TRASH_RETENTION': (
        7,
        'Number of days to keep attachments in trash after users (soft-)deleted '
        'them and before automatically hard-deleting them by the system',
        'positive_int',
    ),
    'AUTO_DELETE_ATTACHMENTS': (
        False,
        'Enable automatic deletion of attachments for users who have exceeded '
        'their storage limits.'
    ),
    'EXPORT_RETENTION': (
        30,
        (
            'Number of minutes after which export tasks are cleaned up.\n'
            'Cannot be less than `SYNCHRONOUS_EXPORT_CACHE_MAX_AGE`.'
        ),
        'positive_int',
    ),
    'OVER_LIMIT_ATTACHMENT_RETENTION': (
        90,
        'Number of days to keep attachments after the user has exceeded their '
        'storage limits.'
    ),
    # Toggle for ZXCVBN
    'ENABLE_PASSWORD_ENTROPY_METER': (
        True,
        'Display an entropy meter and password quality suggestions whenever users change their passwords.',
    ),
    'ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION': (
        False,
        'Enable minimum length validation',
    ),
    'MINIMUM_PASSWORD_LENGTH': (
        10,
        'Minimum length for all passwords.',
        int,
    ),
    'ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION': (
        False,
        'Enable user attribute similarity validation. '
        'See `PASSWORD_USER_ATTRIBUTES` below for customization.',
    ),
    'PASSWORD_USER_ATTRIBUTES': (
        (
            'username\n'
            'full_name\n'
            'email'
        ),
        'List (one per line) all user attributes for similarity validation.\n'
        "Possible attributes are 'username', 'full_name', 'email', 'organization'."
    ),
    'ENABLE_COMMON_PASSWORD_VALIDATION': (
        False,
        'Enable common password validation.\n'
        'To customize the list, go to Configuration file section and add common password file.\n'
        'Django default list is based on https://tinyurl.com/django3-2-common-passwords.',
    ),
    'ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION': (
        False,
        'Enable custom character rules',
    ),
    'PASSWORD_CUSTOM_CHARACTER_RULES': (
        (
            '[[:lower:]]\n'
            '[[:upper:]]\n'
            '\d\n'
            '[\W_]'
        ),
        'List all custom character rules as regular expressions supported '
        'by `regex` python library.\n'
        'One per line.',
    ),
    'PASSWORD_CUSTOM_CHARACTER_RULES_REQUIRED_TO_PASS': (
        3,
        'The minimum number of character rules to pass.',
        int,
    ),
    'ENABLE_MOST_RECENT_PASSWORD_VALIDATION': (
        False,
        'Enable most recent password validation which will prevent the user from '
        'reusing the most recent password.',
    ),
    'ENABLE_CUSTOM_PASSWORD_GUIDANCE_TEXT': (
        False,
        'Enable custom password guidance text to help users create their passwords.',
    ),
    'CUSTOM_PASSWORD_GUIDANCE_TEXT': (
        LazyJSONSerializable(
            {
                'default': t(
                    'The password must be at least 10 characters long and'
                    ' contain 3 or more of the following: uppercase letters,'
                    ' lowercase letters, numbers, and special characters. It'
                    ' cannot be similar to your name, username, or email'
                    ' address.'
                ),
                'some-other-language': (
                    'This will never appear because `some-other-language` is'
                    ' not a valid language code, but this entry is here to show'
                    ' you an example of adding another message in a different'
                    ' language.'
                ),
            }
        ),
        (
            'Guidance message presented when users create or modify a password. '
            'It should reflect the defined password rules.\n\n'
            'Markdown syntax is supported.\n'
            'The “default” message will be used if no translations are provided.'
            ' The “default” should be in English.\n'
            'To add messages in other languages, follow the example of '
            '“some-other-language“, but replace “some-other-language“ with a '
            'valid language code (e.g. “fr“ for French).'
        ),
        'i18n_text_jsonfield_schema',
    ),
    'MASS_EMAIL_ENQUEUED_RECORD_EXPIRY': (
        7,
        'Number of days before enqueued mass email records are marked as failed.',
        'positive_int',
    ),
    'PROJECT_OWNERSHIP_RESUME_THRESHOLD': (
        10,
        'Number of minutes asynchronous tasks can be idle before being '
        'restarted.\n'
        'It is recommended to keep greater than 10 minutes.',
        'positive_int',
    ),
    'PROJECT_OWNERSHIP_STUCK_THRESHOLD': (
        12 * 60,
        (
            'Number of minutes asynchronous tasks can run before being '
            'flagged as failed.\n'
            'Should be greater than `PROJECT_OWNERSHIP_RESUME_THRESHOLD`.'
        ),
        'positive_int',
    ),
    'PROJECT_OWNERSHIP_INVITE_EXPIRY': (
        14,
        'Number of days before invites expire.',
        'positive_int',
    ),
    'PROJECT_OWNERSHIP_INVITE_HISTORY_RETENTION': (
        30,
        (
            'Number of days to keep invites history.\n'
            'Failed invites are kept forever.'
        ),
        'positive_int',
    ),
    'PROJECT_OWNERSHIP_IN_APP_MESSAGES_EXPIRY': (
        7,
        'The number of days after which in-app messages expire.',
        'positive_int',
    ),
    'PROJECT_OWNERSHIP_AUTO_ACCEPT_INVITES': (
        False,
        'Auto-accept invites by default and do not sent them by e-mail.'
    ),
    'PROJECT_OWNERSHIP_ADMIN_EMAIL': (
        '',
        (
            'Email addresses to which error reports are sent, one per line.\n'
            'Leave empty to not send emails.'
        ),
    ),
    'PROJECT_OWNERSHIP_ADMIN_EMAIL_SUBJECT': (
        'KoboToolbox Notifications: Project ownership transfer failure',
        'Email subject to sent to admins on failure.',
    ),
    'PROJECT_OWNERSHIP_ADMIN_EMAIL_BODY': (
        (
            'Dear admins,\n\n'
            'A transfer of project ownership has failed:\n'
            '##invite_url##'
        ),
        'Email message to sent to admins on failure.',
    ),
    'PROJECT_HISTORY_LOG_LIFESPAN': (
        60,
        'Length of time days to keep project history logs.',
        'positive_int',
    ),
    'ACCESS_LOG_LIFESPAN': (
        60,
        'Length of time in days to keep access logs.',
        'positive_int',
    ),
    'USE_TEAM_LABEL': (
        True,
        'Use the term "Team" instead of "Organization" when Stripe is not enabled',
    ),
    'MASS_EMAIL_TEST_EMAILS': (
        '',
        'List (one per line) users who will be sent test emails when using the \n'
        '"test_users" query for MassEmailConfigs',
    ),
    'ALLOW_SELF_ACCOUNT_DELETION': (
        False,
        'Allow users to delete their own account.',
    ),
}

CONSTANCE_ADDITIONAL_FIELDS = {
    'i18n_text_jsonfield_schema': [
        'kpi.fields.jsonschema_form_field.I18nTextJSONField',
        {'widget': 'django.forms.Textarea'},
    ],
    'long_metadata_fields_jsonschema': [
        'kpi.fields.jsonschema_form_field.UserMetadataFieldsListField',
        {
            'widget': 'django.forms.Textarea',
            'widget_kwargs': {
                'attrs': {'rows': 45}
            }
        },
    ],
    'long_textfield': [
        'django.forms.fields.CharField',
        {
            'widget': 'django.forms.Textarea',
            'widget_kwargs': {
                'attrs': {'rows': 30}
            }
        },
    ],
    'metadata_fields_jsonschema': [
        'kpi.fields.jsonschema_form_field.MetadataFieldsListField',
        {'widget': 'django.forms.Textarea'},
    ],
    'positive_int': ['django.forms.fields.IntegerField', {
        'min_value': 0
    }],
    'positive_int_minus_one': ['django.forms.fields.IntegerField', {
        'min_value': -1
    }],
    'positive_int': ['django.forms.fields.IntegerField', {
        'min_value': 0
    }],
}

CONSTANCE_CONFIG_FIELDSETS = {
    'General Options': (
        'REGISTRATION_OPEN',
        'REGISTRATION_ALLOWED_EMAIL_DOMAINS',
        'REGISTRATION_DOMAIN_NOT_ALLOWED_ERROR_MESSAGE',
        'REGISTRATION_BLACKLIST_EMAIL_DOMAINS',
        'REGISTRATION_BLACKLIST_ERROR_MESSAGE',
        'TERMS_OF_SERVICE_URL',
        'PRIVACY_POLICY_URL',
        'SOURCE_CODE_URL',
        'SUPPORT_EMAIL',
        'SUPPORT_URL',
        'ACADEMY_URL',
        'COMMUNITY_URL',
        'SYNCHRONOUS_EXPORT_CACHE_MAX_AGE',
        'EXPORT_RETENTION',
        'EXPOSE_GIT_REV',
        'FRONTEND_MIN_RETRY_TIME',
        'FRONTEND_MAX_RETRY_TIME',
        'USE_TEAM_LABEL',
        'ACCESS_LOG_LIFESPAN',
        'PROJECT_HISTORY_LOG_LIFESPAN',
        'ORGANIZATION_INVITE_EXPIRY',
        'MASS_EMAIL_ENQUEUED_RECORD_EXPIRY',
        'MASS_EMAIL_TEST_EMAILS',
        'USAGE_LIMIT_ENFORCEMENT',
    ),
    'Rest Services': (
        'ALLOW_UNSECURED_HOOK_ENDPOINTS',
        'HOOK_MAX_RETRIES',
    ),
    'Natural language processing': (
        'ASR_MT_INVITEE_USERNAMES',
        'ASR_MT_GOOGLE_PROJECT_ID',
        'ASR_MT_GOOGLE_STORAGE_BUCKET_PREFIX',
        'ASR_MT_GOOGLE_TRANSLATION_LOCATION',
        'ASR_MT_GOOGLE_CREDENTIALS',
        'ASR_MT_GOOGLE_REQUEST_TIMEOUT',
    ),
    'Security': (
        'SSRF_ALLOWED_IP_ADDRESS',
        'SSRF_DENIED_IP_ADDRESS',
        'MFA_ISSUER_NAME',
        'MFA_ENABLED',
        'MFA_LOCALIZED_HELP_TEXT',
        'SUPERUSER_AUTH_ENFORCEMENT',
    ),
    'Metadata options': (
        'USER_METADATA_FIELDS',
        'PROJECT_METADATA_FIELDS',
        'SECTOR_CHOICES',
        'OPERATIONAL_PURPOSE_CHOICES',
    ),
    'Password Validation': (
        'ENABLE_PASSWORD_ENTROPY_METER',
        'ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION',
        'ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION',
        'ENABLE_COMMON_PASSWORD_VALIDATION',
        'ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION',
        'ENABLE_MOST_RECENT_PASSWORD_VALIDATION',
        'ENABLE_CUSTOM_PASSWORD_GUIDANCE_TEXT',
        'MINIMUM_PASSWORD_LENGTH',
        'PASSWORD_USER_ATTRIBUTES',
        'PASSWORD_CUSTOM_CHARACTER_RULES',
        'PASSWORD_CUSTOM_CHARACTER_RULES_REQUIRED_TO_PASS',
        'CUSTOM_PASSWORD_GUIDANCE_TEXT',
    ),
    'Transfer project ownership': (
        'PROJECT_OWNERSHIP_RESUME_THRESHOLD',
        'PROJECT_OWNERSHIP_STUCK_THRESHOLD',
        'PROJECT_OWNERSHIP_INVITE_HISTORY_RETENTION',
        'PROJECT_OWNERSHIP_INVITE_EXPIRY',
        'PROJECT_OWNERSHIP_IN_APP_MESSAGES_EXPIRY',
        'PROJECT_OWNERSHIP_ADMIN_EMAIL',
        'PROJECT_OWNERSHIP_ADMIN_EMAIL_SUBJECT',
        'PROJECT_OWNERSHIP_ADMIN_EMAIL_BODY',
        'PROJECT_OWNERSHIP_AUTO_ACCEPT_INVITES',
    ),
    'Trash bin': (
        'ACCOUNT_TRASH_RETENTION',
        'ATTACHMENT_TRASH_RETENTION',
        'PROJECT_TRASH_RETENTION',
        'OVER_LIMIT_ATTACHMENT_RETENTION',
        'AUTO_DELETE_ATTACHMENTS',
        'ALLOW_SELF_ACCOUNT_DELETION',
    ),
    'Regular maintenance settings': (
        'ASSET_SNAPSHOT_DAYS_RETENTION',
        'IMPORT_TASK_DAYS_RETENTION',
        'SUBMISSION_HISTORY_RETENTION',
    ),
}

# Tell django-constance to use a database model instead of Redis
CONSTANCE_BACKEND = 'kobo.apps.constance_backends.database.DatabaseBackend'
CONSTANCE_DATABASE_CACHE_BACKEND = 'default'


# Warn developers to use `pytest` instead of `./manage.py test`
class DoNotUseRunner:
    def __init__(self, *args, **kwargs):
        raise NotImplementedError('Please run tests with `pytest` instead')


TEST_RUNNER = __name__ + '.DoNotUseRunner'

# ModelBackend does not interfere with object-level permissions: it always denies
# object-specific requests (see
# https://github.com/django/django/blob/1.7/django/contrib/auth/backends.py#L44 ).
AUTHENTICATION_BACKENDS = (
    'kpi.backends.ModelBackend',
    'kpi.backends.ObjectPermissionBackend',
    'allauth.account.auth_backends.AuthenticationBackend',
)

ROOT_URLCONF = 'kobo.urls'

WSGI_APPLICATION = 'kobo.wsgi.application'

# What User object should be mapped to AnonymousUser?
ANONYMOUS_USER_ID = -1
# Permissions assigned to AnonymousUser are restricted to the following
ALLOWED_ANONYMOUS_PERMISSIONS = (
    'kpi.view_asset',
    'kpi.discover_asset',
    'kpi.add_submissions',
    'kpi.view_submissions',
)

# run heavy migration scripts by default
# NOTE: this should be set to False for major deployments. This can take a long time
SKIP_HEAVY_MIGRATIONS = env.bool('SKIP_HEAVY_MIGRATIONS', False)

# Database
# https://docs.djangoproject.com/en/1.7/ref/settings/#databases
DATABASES = {
    'default': env.db_url(
        'KPI_DATABASE_URL' if 'KPI_DATABASE_URL' in os.environ else 'DATABASE_URL',
        default='sqlite:///%s/db.sqlite3' % BASE_DIR
    ),
}

OPENROSA_DB_ALIAS = 'kobocat'

if 'KC_DATABASE_URL' in os.environ:
    DATABASES[OPENROSA_DB_ALIAS] = env.db_url('KC_DATABASE_URL')

DATABASE_ROUTERS = ['kpi.db_routers.DefaultDatabaseRouter']

# Internationalization
# https://docs.djangoproject.com/en/1.8/topics/i18n/

django.conf.locale.LANG_INFO.update(EXTRA_LANG_INFO)

DJANGO_LANGUAGE_CODES = env.str(
    'DJANGO_LANGUAGE_CODES',
    default=(
        'am '  # Amharic
        'ar '  # Arabic
        'bn '  # Bengali
        'cs '  # Czech
        'de '  # German
        'en '  # English
        'es '  # Spanish
        'fa '  # Persian/Farsi
        'fr '  # French
        'hi '  # Hindi
        'hu '  # Hungarian
        'id '  # Indonesian
        'ja '  # Japanese
        'km '  # Khmer
        'ku '  # Kurdish
        'ln '  # Lingala
        'my '  # Burmese/Myanmar
        'ny '  # Chewa/Chichewa/Nyanja
        'ne '  # Nepali
        'pl '  # Polish
        'pt '  # Portuguese
        'ru '  # Russian
        'sw '  # Swahili
        'th '  # Thai
        'tr '  # Turkish
        'uk '  # Ukrainian
        'vi '  # Vietnamese
        'yo '  # Yoruba
        'zh-hans'  # Chinese Simplified
    )
)
LANGUAGES = [
    (lang_code, get_language_info(lang_code)['name_local'])
    for lang_code in DJANGO_LANGUAGE_CODES.split(' ')
]

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

LOCALE_PATHS = (os.path.join(BASE_DIR, 'locale'),)

USE_I18N = True

USE_TZ = True

CAN_LOGIN_AS = lambda request, target_user: request.user.is_superuser

# Default page size when no limit is specified in API requests.
# Currently for submission lists only, but naming is future-proof for all endpoints
DEFAULT_API_PAGE_SIZE = env.int('DEFAULT_API_PAGE_SIZE', 100)
# Maximum page size for API responses. Currently applies to submission lists only,
# but will likely be extended to all endpoints in the future
MAX_API_PAGE_SIZE = env.int('MAX_API_PAGE_SIZE', 1000)

# uWSGI, NGINX, etc. allow only a limited amount of time to process a request.
# Set this value to match their limits
SYNCHRONOUS_REQUEST_TIME_LIMIT = 120  # seconds

# REMOVE the oldest if a user exceeds this many exports for a particular form
MAXIMUM_EXPORTS_PER_USER_PER_FORM = 10

MAX_RETRIES_FOR_IMPORT_EXPORT_TASK = 10

# Private media file configuration
PRIVATE_STORAGE_ROOT = os.path.join(BASE_DIR, 'media')
PRIVATE_STORAGE_AUTH_FUNCTION = \
    'kpi.utils.private_storage.superuser_or_username_matches_prefix'

# django-markdownx, for in-app messages
MARKDOWNX_UPLOAD_URLS_PATH = reverse_lazy('markdownx-uploader-image-upload')
MARKDOWNX_UPLOAD_CONTENT_TYPES = [
    'image/jpeg',
    'image/png',
    'image/svg+xml',
    'image/gif',
    'image/webp',
]
# Github-flavored Markdown from `py-gfm`,
# ToDo Uncomment when it's compatible with Markdown 3.x
# MARKDOWNX_MARKDOWN_EXTENSIONS = ['mdx_gfm']

# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/1.7/howto/static-files/

STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATIC_URL = '/static/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
MEDIA_URL = '/' + os.environ.get('KPI_MEDIA_URL', 'media').strip('/') + '/'

# `PUBLIC_MEDIA_PATH` sets the `upload_to` attribute of explicitly-public
# `FileField`s, e.g. in `ConfigurationFile`. The corresponding location on the
# file system (usually `MEDIA_ROOT + PUBLIC_MEDIA_PATH`) should be exposed to
# everyone via NGINX. For more information, see
# https://docs.djangoproject.com/en/2.2/ref/models/fields/#django.db.models.FileField.upload_to
PUBLIC_MEDIA_PATH = '__public/'

# Following the uWSGI mountpoint convention, this should have a leading slash
# but no trailing slash
KPI_PREFIX = env.str('KPI_PREFIX', 'False')
if KPI_PREFIX.lower() == 'false':
    KPI_PREFIX = False
else:
    KPI_PREFIX = '/' + KPI_PREFIX.strip('/')

# KPI_PREFIX should be set in the environment when running in a subdirectory
if KPI_PREFIX and KPI_PREFIX != '/':
    STATIC_URL = KPI_PREFIX + '/' + STATIC_URL.lstrip('/')
    MEDIA_URL = KPI_PREFIX + '/' + MEDIA_URL.lstrip('/')
    LOGIN_URL = KPI_PREFIX + '/' + global_settings.LOGIN_URL.lstrip('/')
    LOGIN_REDIRECT_URL = KPI_PREFIX + '/' + LOGIN_REDIRECT_URL.lstrip('/')

STATICFILES_DIRS = (
    os.path.join(BASE_DIR, 'jsapp'),
    os.path.join(BASE_DIR, 'static'),
)

if os.path.exists(os.path.join(BASE_DIR, 'dkobo', 'jsapp')):
    STATICFILES_DIRS = STATICFILES_DIRS + (
        os.path.join(BASE_DIR, 'dkobo', 'jsapp'),
        os.path.join(BASE_DIR, 'dkobo', 'dkobo', 'static'),
    )

REST_FRAMEWORK = {
    'URL_FIELD_NAME': 'url',
    'DEFAULT_PAGINATION_CLASS': 'kpi.paginators.DefaultPagination',
    'PAGE_SIZE': 100,
    'DEFAULT_AUTHENTICATION_CLASSES': [
        # SessionAuthentication and BasicAuthentication would be included by
        # default
        'kpi.authentication.SessionAuthentication',
        'kpi.authentication.BasicAuthentication',
        'kpi.authentication.TokenAuthentication',
        'kpi.authentication.OAuth2Authentication',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
        # "BasicHTMLRenderer" must always come after JSONRenderer
        'kpi.renderers.BasicHTMLRenderer',
    ],
    'DEFAULT_VERSIONING_CLASS': 'kpi.versioning.APIAutoVersioning',
    # Cannot be placed in kpi.exceptions.py because of circular imports
    'EXCEPTION_HANDLER': 'kpi.utils.drf_exceptions.custom_exception_handler',
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_PARENT_LOOKUP_KWARG_NAME_PREFIX': 'uid_',
}

# Settings for the API documentation using drf-spectacular
SPECTACULAR_SETTINGS = {
    'TITLE': 'KoboToolbox Primary API',
    'DESCRIPTION': (
        'This page documents all KoboToolbox API endpoints, except for those '
        'implementing the OpenRosa protocol, which are [documented separately](/api/openrosa/docs/).'  # noqa
        '\n\n'
        'The endpoints are grouped by area of intended use. Each category contains '
        'related endpoints, with detailed documentation on usage and configuration. '
        'Use this as a reference to quickly find the right endpoint for managing '
        'projects, forms, data, permissions, integrations, logs, and organizational '
        'resources.\n\n'
        '**General note**: All projects (whether deployed or draft), as well as all '
        'library content (questions, blocks, templates, and collections) in the '
        'user-facing application are represented in the API as "assets".'
    ),
    'VERSION': '2.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'SWAGGER_UI_FAVICON_HREF': '/static/favicon.png',
    'SWAGGER_UI_SETTINGS': {
        'filter': True,
        'docExpansion': None,  # collapse all by default
    },
    'AUTHENTICATION_WHITELIST': [
        'kpi.authentication.BasicAuthentication',
        'kpi.authentication.TokenAuthentication',
    ],
    'ENUM_NAME_OVERRIDES': {
        'InviteStatusChoicesEnum': 'kobo.apps.organizations.models.OrganizationInviteStatusChoices.choices',  # noqa
        'InviteeRoleEnum': 'kpi.schema_extensions.v2.members.schema.ROLE_CHOICES_PAYLOAD_ENUM',  # noqa
        'MemberRoleEnum': 'kpi.schema_extensions.v2.members.schema.ROLE_CHOICES_ENUM',
        'StripeProductType': 'kpi.schema_extensions.v2.stripe.schema.PRODUCT_TYPE_ENUM',
        'StripePriceType': 'kpi.schema_extensions.v2.stripe.schema.PRICE_TYPE_ENUM',
        'StripeIntervalEnum': 'kpi.schema_extensions.v2.stripe.schema.INTERVAL_ENUM',
        'StripeUsageType': 'kpi.schema_extensions.v2.stripe.schema.USAGE_TYPE_ENUM',
        'QualSimpleQuestionParamsTypeEnum': 'kpi.schema_extensions.v2.subsequences.schema.SIMPLE_QUESTION_TYPE_ENUM',  # noqa
        'QualSelectQuestionParamsTypeEnum': 'kpi.schema_extensions.v2.subsequences.schema.SELECT_QUESTION_TYPE_ENUM',  # noqa
    },
    # We only want to blacklist BasicHTMLRenderer, but nothing like RENDERER_WHITELIST
    # exists 🤦
    # List all the renderers that are used by documented API
    'RENDERER_WHITELIST': [
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.StaticHTMLRenderer',
        'kpi.renderers.MediaFileRenderer',
        'kpi.renderers.MP3ConversionRenderer',
        'kpi.renderers.OpenRosaRenderer',
        'kpi.renderers.OpenRosaFormListRenderer',
        'kpi.renderers.OpenRosaManifestRenderer',
        'kpi.renderers.SSJsonRenderer',
        'kpi.renderers.SubmissionGeoJsonRenderer',
        'kpi.renderers.DoNothingRenderer',
        'kpi.renderers.SubmissionXLSXRenderer',
        'kpi.renderers.SubmissionCSVRenderer',
        'kpi.renderers.SubmissionXMLRenderer',
        'kpi.renderers.XMLRenderer',
        'kpi.renderers.XFormRenderer',
        'kpi.renderers.XlsRenderer',
        'kobo.apps.openrosa.libs.renderers.renderers.XLSRenderer',
        'kobo.apps.openrosa.libs.renderers.renderers.XLSXRenderer',
        'kobo.apps.openrosa.libs.renderers.renderers.CSVRenderer',
        'kobo.apps.openrosa.libs.renderers.renderers.RawXMLRenderer',
        'kobo.apps.openrosa.libs.renderers.renderers.TemplateXMLRenderer',
    ],
    'TAGS': [
        {
            'name': 'Manage projects and library content',
            'description': (
                'Create, organize, and manage projects, assets '
                '(projects/library content), and tags',
            ),
        },
        {
            'name': 'Form content',
            'description': (
                'Export and preview assets (projects/library content) in different '
                'formats'
            ),
        },
        {
            'name': 'Survey data',
            'description': 'View, edit, validate, export, and report collected data',
        },
        {
            'name': 'Survey data - Rest Services',
            'description': 'Configure and manage webhooks for survey data integrations',
        },
        {
            'name': 'Manage permissions',
            'description': (
                'Assign, clone, and bulk-manage project and asset '
                '(projects/library content) permissions'
            ),
        },
        {
            'name': 'Logging',
            'description': 'Project history logs, access logs, Rest Service hook logs',
        },
        {
            'name': 'Library collections',
            'description': 'Subscribe to and manage shared library collections',
        },
        {
            'name': 'Server logs (superusers)',
            'description': 'View server-wide logs',
        },
        {
            'name': 'User / team / organization / usage',
            'description': 'Manage users, orgs, invites, roles, and usage tracking',
        },
        {
            'name': 'Other',
            'description': 'Languages, available permissions, other',
        },
    ],
}

SPECTACULAR_OPENROSA_TITLE = 'KoboToolbox OpenRosa API'

SPECTACULAR_OPENROSA_DESCRIPTION = (
    'Welcome to the documentation for the KoboToolbox OpenRosa API. Data collection '
    'clients, including KoboCollect and web forms, use the API endpoints described '
    'here to retrieve surveys and upload submissions.\n\n'
    'Our separate documentation of the primary KoboToolbox API endpoints, used to '
    'manage projects and data, can be found [here](/api/v2/docs/).'
)

OPENROSA_REST_FRAMEWORK = {

    'DEFAULT_PAGINATION_CLASS': None,
    'DEFAULT_VERSIONING_CLASS': None,

    # deprecated
    # # Use hyperlinked styles by default.
    # # Only used if the `serializer_class` attribute is not set on a view.
    # 'DEFAULT_MODEL_SERIALIZER_CLASS': (
    #     'rest_framework.serializers.HyperlinkedModelSerializer'
    # ),
    # # Use Django's standard `django.contrib.auth` permissions,
    # # or allow read-only access for unauthenticated users.
    # 'DEFAULT_PERMISSION_CLASSES': [
    #     'rest_framework.permissions.AllowAny',
    # ],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'kpi.authentication.DigestAuthentication',
        'kpi.authentication.OAuth2Authentication',
        'kpi.authentication.TokenAuthentication',
        # HttpsOnlyBasicAuthentication must come before SessionAuthentication because
        # Django authentication is called before DRF authentication and users get authenticated with
        # Session if it comes first (which bypass BasicAuthentication and MFA validation)
        'kobo.apps.openrosa.libs.authentication.HttpsOnlyBasicAuthentication',
        'kpi.authentication.SessionAuthentication',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        # Keep JSONRenderer at the top "in order to send JSON responses to
        # clients that do not specify an Accept header." See
        # http://www.django-rest-framework.org/api-guide/renderers/#ordering-of-renderer-classes
        'rest_framework.renderers.JSONRenderer',
        'rest_framework_jsonp.renderers.JSONPRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
        'rest_framework_xml.renderers.XMLRenderer',
        'rest_framework_csv.renderers.CSVRenderer',
    ],
    # FIXME Kobocat migration: Move to main REST_FRAMEWORK and change logic to handle kobocat view properly
    'VIEW_NAME_FUNCTION': 'kobo.apps.openrosa.apps.api.tools.get_view_name',
    'VIEW_DESCRIPTION_FUNCTION': 'kobo.apps.openrosa.apps.api.tools.get_view_description',
}

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                # Default processors per
                # https://docs.djangoproject.com/en/1.8/ref/templates/upgrading/#the-templates-settings
                'django.contrib.auth.context_processors.auth',
                'django.template.context_processors.debug',
                'django.template.context_processors.i18n',
                'django.template.context_processors.media',
                'django.template.context_processors.static',
                'django.template.context_processors.tz',
                'django.template.context_processors.request',
                'django.contrib.messages.context_processors.messages',
                # Additional processors
                'kpi.context_processors.custom_password_guidance_text',
                'kpi.context_processors.external_service_tokens',
                'kpi.context_processors.email',
                'kpi.context_processors.sitewide_messages',
                'kpi.context_processors.config',
                'kpi.context_processors.mfa',
                'kpi.context_processors.django_settings',
                'kpi.context_processors.kobocat',
            ],
            'debug': os.environ.get('TEMPLATE_DEBUG', 'False') == 'True',
        },
    },
]

DEFAULT_SUBMISSIONS_COUNT_NUMBER_OF_DAYS = 31
GOOGLE_ANALYTICS_TOKEN = os.environ.get('GOOGLE_ANALYTICS_TOKEN')
SENTRY_JS_DSN = None
if SENTRY_JS_DSN_URL := env.url('SENTRY_JS_DSN', default=None):
    SENTRY_JS_DSN = SENTRY_JS_DSN_URL.geturl()

# replace this with the pointer to the KoboCAT server, if it exists
KOBOCAT_URL = os.environ.get('KOBOCAT_URL', 'https://change-me.invalid')

# In case server must serve two KoboCAT domain names (e.g. during a
# domain name transfer), `settings.KOBOCAT_OLD_URL` adds support for
# the domain name.
KOBOCAT_OLD_URL = os.environ.get('KOBOCAT_OLD_URL')

# Internal URL does not use HTTPS
KOBOCAT_INTERNAL_URL = os.environ.get(
    'KOBOCAT_INTERNAL_URL', 'http://change-me.invalid'
)

KOBOFORM_URL = os.environ.get('KOBOFORM_URL', 'https://change-me.invalid')

if 'KOBOCAT_URL' in os.environ:
    DEFAULT_DEPLOYMENT_BACKEND = 'openrosa'
else:
    DEFAULT_DEPLOYMENT_BACKEND = 'mock'


"""
Stripe configuration intended for kf.kobotoolbox.org only,
tracks usage limit exceptions
"""
STRIPE_ENABLED = env.bool('STRIPE_ENABLED', False)


def dj_stripe_request_callback_method():
    # This method exists because dj-stripe's documentation doesn't reflect reality.
    # It claims that DJSTRIPE_SUBSCRIBER_MODEL no longer needs a request callback but
    # this error occurs without it: `DJSTRIPE_SUBSCRIBER_MODEL_REQUEST_CALLBACK must
    # be implemented if a DJSTRIPE_SUBSCRIBER_MODEL is defined`
    # It doesn't need to do anything other than exist
    # https://github.com/dj-stripe/dj-stripe/issues/1900
    pass


DJSTRIPE_SUBSCRIBER_MODEL = 'organizations.Organization'
DJSTRIPE_SUBSCRIBER_MODEL_REQUEST_CALLBACK = dj_stripe_request_callback_method
DJSTRIPE_FOREIGN_KEY_TO_FIELD = 'id'
DJSTRIPE_USE_NATIVE_JSONFIELD = True
STRIPE_LIVE_MODE = env.bool('STRIPE_LIVE_MODE', False)
STRIPE_TEST_PUBLIC_KEY = env.str(
    'STRIPE_TEST_PUBLIC_KEY', 'pk_test_qliDXQRyVGPWmsYR69tB1NPx00ndTrJfVM'
)
STRIPE_LIVE_PUBLIC_KEY = 'pk_live_7JRQ5elvhnmz4YuWdlSRNmMj00lhvqZz8P'
if STRIPE_ENABLED:
    INSTALLED_APPS += ('djstripe', 'kobo.apps.stripe')
    STRIPE_LIVE_SECRET_KEY = env.str('STRIPE_LIVE_SECRET_KEY', None)
    STRIPE_TEST_SECRET_KEY = env.str('STRIPE_TEST_SECRET_KEY', None)
    DJSTRIPE_WEBHOOK_SECRET = env.str('DJSTRIPE_WEBHOOK_SECRET', None)
    DJSTRIPE_WEBHOOK_VALIDATION = env.str('DJSTRIPE_WEBHOOK_VALIDATION', 'verify_signature')
STRIPE_PUBLIC_KEY = STRIPE_LIVE_PUBLIC_KEY if STRIPE_LIVE_MODE else STRIPE_TEST_PUBLIC_KEY

"""Organizations settings"""
# necessary to prevent calls to `/organizations/{ORG_ID}/service_usage/` (and any other
# queries that may need to aggregate data for all organization users) from slowing down db
ORGANIZATION_USER_LIMIT = env.str('ORGANIZATION_USER_LIMIT', 400)


""" Enketo configuration """
ENKETO_URL = os.environ.get('ENKETO_URL') or os.environ.get(
    'ENKETO_SERVER', 'https://change-me.invalid'
)
ENKETO_URL = ENKETO_URL.rstrip('/')  # Remove any trailing slashes
ENKETO_VERSION = os.environ.get('ENKETO_VERSION', 'Legacy').lower()
ENKETO_INTERNAL_URL = os.environ.get('ENKETO_INTERNAL_URL', ENKETO_URL)
ENKETO_INTERNAL_URL = ENKETO_INTERNAL_URL.rstrip('/')  # Remove any trailing slashes

ENKETO_API_KEY = os.environ.get('ENKETO_API_KEY', 'enketorules')
# http://apidocs.enketo.org/v2/
ENKETO_SURVEY_ENDPOINT = 'api/v2/survey/all'
ENKETO_PREVIEW_ENDPOINT = 'api/v2/survey/preview/iframe'
ENKETO_EDIT_INSTANCE_ENDPOINT = 'api/v2/instance'
ENKETO_VIEW_INSTANCE_ENDPOINT = 'api/v2/instance/view'
ENKETO_FLUSH_CACHE_ENDPOINT = 'api/v2/survey/cache'
# How long to wait before flushing an individual preview from Enketo's cache
ENKETO_FLUSH_CACHED_PREVIEW_DELAY = 1800  # seconds

# Content Security Policy (CSP)
# CSP should "just work" by allowing any possible configuration
# however CSP_EXTRA_DEFAULT_SRC is provided to allow for custom additions
if env.bool('ENABLE_CSP', False):
    MIDDLEWARE.append('csp.middleware.CSPMiddleware')
local_unsafe_allows = [
    "'unsafe-eval'",
    'http://localhost:3000',
    'http://kf.kobo.local:3000',
    'ws://kf.kobo.local:3000'
]
CSP_DEFAULT_SRC = env.list('CSP_EXTRA_DEFAULT_SRC', str, []) + [
    "'self'",
    KOBOCAT_URL,
    ENKETO_URL,
]
if env.str('FRONTEND_DEV_MODE', None) == 'host':
    CSP_DEFAULT_SRC += local_unsafe_allows
CSP_CONNECT_SRC = CSP_DEFAULT_SRC
CSP_SCRIPT_SRC = CSP_DEFAULT_SRC
CSP_STYLE_SRC = CSP_DEFAULT_SRC + ["'unsafe-inline'"]
CSP_IMG_SRC = CSP_DEFAULT_SRC + [
    'data:',
    'https://*.openstreetmap.org',
    'https://*.openstreetmap.fr',  # Humanitarian OpenStreetMap Team
    'https://*.opentopomap.org',
    'https://*.arcgisonline.com'
]
CSP_FRAME_SRC = CSP_DEFAULT_SRC

if GOOGLE_ANALYTICS_TOKEN:
    # Taken from https://developers.google.com/tag-platform/tag-manager/csp#google_analytics_4_google_analytics
    CSP_SCRIPT_SRC.append('https://*.googletagmanager.com')
    CSP_CONNECT_SRC.extend(
        [
            'https://*.google-analytics.com',
            'https://*.analytics.google.com',
            'https://*.googletagmanager.com',
        ]
    )
    CSP_IMG_SRC.extend(
        ['https://*.google-analytics.com', 'https://*.googletagmanager.com']
    )
if SENTRY_JS_DSN_URL and SENTRY_JS_DSN_URL.scheme:
    sentry_js_url = SENTRY_JS_DSN_URL.scheme + '://' + SENTRY_JS_DSN_URL.hostname
    CSP_SCRIPT_SRC.append(sentry_js_url)
    CSP_CONNECT_SRC.append(sentry_js_url)
if STRIPE_ENABLED:
    stripe_domain = 'https://js.stripe.com'
    CSP_SCRIPT_SRC.append(stripe_domain)
    CSP_FRAME_SRC.append(stripe_domain)

csp_report_uri = env.url('CSP_REPORT_URI', None)
if csp_report_uri:  # Let environ validate uri, but set as string
    CSP_REPORT_URI = csp_report_uri.geturl()
CSP_REPORT_ONLY = env.bool('CSP_REPORT_ONLY', False)

""" Celery configuration """
# Celery 4.0 New lowercase settings.
# Uppercase settings can be used when using a PREFIX
# http://docs.celeryproject.org/en/latest/userguide/configuration.html#new-lowercase-settings
# http://docs.celeryproject.org/en/4.0/whatsnew-4.0.html#step-2-update-your-configuration-with-the-new-setting-names

CELERY_TIMEZONE = 'UTC'

# helpful for certain debugging
CELERY_TASK_ALWAYS_EAGER = env.bool('SKIP_CELERY', False)

# Replace a worker after it completes 7 tasks by default. This allows the OS to
# reclaim memory allocated during large tasks
CELERY_WORKER_MAX_TASKS_PER_CHILD = int(os.environ.get(
    'CELERYD_MAX_TASKS_PER_CHILD', 7))

# Default to a 30-minute soft time limit and a 35-minute hard time limit
CELERY_TASK_TIME_LIMIT = int(
    os.environ.get('CELERYD_TASK_TIME_LIMIT', 2100)  # seconds
)

CELERY_TASK_SOFT_TIME_LIMIT = int(
    os.environ.get('CELERYD_TASK_SOFT_TIME_LIMIT', 1800)  # seconds
)

CELERY_BEAT_SCHEDULE = {
    # Schedule every day at midnight UTC. Can be customized in admin section
    'send-hooks-failures-reports': {
        'task': 'kobo.apps.hook.tasks.failures_reports',
        'schedule': crontab(hour=0, minute=0),
        'options': {'queue': 'kpi_low_priority_queue'},
    },
    # Schedule every 30 minutes
    'trash-bin-garbage-collector': {
        'task': 'kobo.apps.trash_bin.tasks.garbage_collector',
        'schedule': crontab(minute='*/30'),
        'options': {'queue': 'kpi_low_priority_queue'},
    },
    # Schedule every 30 minutes
    'trash-bin-task-restarter': {
        'task': 'kobo.apps.trash_bin.tasks.task_restarter',
        'schedule': crontab(minute='*/30'),
        'options': {'queue': 'kpi_low_priority_queue'}
    },
    'perform-maintenance': {
        'task': 'kpi.tasks.perform_maintenance',
        'schedule': crontab(hour=20, minute=0),
        'options': {'queue': 'kpi_low_priority_queue'},
    },
    'log-stuck-exports-and-mark-failed': {
        'task': 'kobo.apps.openrosa.apps.viewer.tasks.log_stuck_exports_and_mark_failed',
        'schedule': timedelta(hours=6),
        'options': {'queue': 'kobocat_queue'}
    },
    'delete-daily-xform-submissions-counter': {
        'task': 'kobo.apps.openrosa.apps.logger.tasks.delete_daily_counters',
        'schedule': crontab(hour=0, minute=0),
        'options': {'queue': 'kobocat_queue'},
    },
    'delete-expired-instance-history-records': {
        'task': 'kobo.apps.openrosa.apps.logger.tasks.delete_expired_instance_history_records',  # noqa
        'schedule': crontab(hour=1, minute=0),
        'options': {'queue': 'kobocat_queue'}
    },
    # Schedule every 30 minutes
    'organization-invite-mark-as-expired': {
        'task': 'kobo.apps.organizations.tasks.mark_organization_invite_as_expired',
        'schedule': crontab(minute='*/30'),
        'options': {'queue': 'kpi_low_priority_queue'},
    },
    # Schedule every 10 minutes
    'project-ownership-task-restarter': {
        'task': 'kobo.apps.project_ownership.tasks.task_restarter',
        'schedule': crontab(minute='*/30'),
        'options': {'queue': 'kpi_low_priority_queue'}
    },
    # Schedule every 30 minutes
    'project-ownership-mark-as-failed': {
        'task': 'kobo.apps.project_ownership.tasks.mark_as_failed',
        'schedule': crontab(minute='*/30'),
        'options': {'queue': 'kpi_low_priority_queue'}
    },
    # Schedule every 30 minutes
    'project-ownership-mark-as-expired': {
        'task': 'kobo.apps.project_ownership.tasks.mark_as_expired',
        'schedule': crontab(minute='*/30'),
        'options': {'queue': 'kpi_low_priority_queue'}
    },
    # Schedule every 30 minutes
    'attachment-cleanup-for-users-exceeding-limits': {
        'task': 'kobo.apps.trash_bin.tasks.attachment.schedule_auto_attachment_cleanup_for_users',  # noqa
        'schedule': crontab(minute='*/30'),
        'options': {'queue': 'kpi_low_priority_queue'}
    },
    # Schedule every 5 minutes
    'cleanup-anonymous-exports': {
        'task': 'kpi.tasks.cleanup_anonymous_exports',
        'schedule': crontab(minute='*/5'),
        'options': {'queue': 'kpi_low_priority_queue'},
    },
    # Schedule every 5 minutes
    'cleanup-synchronous-exports': {
        'task': 'kpi.tasks.cleanup_synchronous_exports',
        'schedule': crontab(minute='*/5'),
        'options': {'queue': 'kpi_low_priority_queue'},
    },
    # Schedule every 5 minutes
    'cleanup-project-view-exports': {
        'task': 'kobo.apps.project_views.tasks.cleanup_project_view_exports',
        'schedule': crontab(minute='*/5'),
        'options': {'queue': 'kpi_low_priority_queue'},
    },
    # Schedule every 5 minutes
    'cleanup-access-log-exports': {
        'task': 'kobo.apps.audit_log.tasks.cleanup_access_log_exports',
        'schedule': crontab(minute='*/5'),
        'options': {'queue': 'kpi_low_priority_queue'},
    },
    # Schedule every 5 minutes
    'cleanup-project-history-log-exports': {
        'task': 'kobo.apps.audit_log.tasks.cleanup_project_history_log_exports',
        'schedule': crontab(minute='*/5'),
        'options': {'queue': 'kpi_low_priority_queue'},
    },
    # Schedule every 15 minutes
    'refresh-user-report-snapshot': {
        'task': 'kobo.apps.user_reports.tasks.refresh_user_report_snapshots',
        'schedule': crontab(minute='*/15'),
        'options': {'queue': 'kpi_long_running_tasks_queue'},
    },
    # Schedule every day at midnight UTC
    'project-ownership-garbage-collector': {
        'task': 'kobo.apps.project_ownership.tasks.garbage_collector',
        'schedule': crontab(minute=0, hour=0),
        'options': {'queue': 'kpi_low_priority_queue'}
    },
    # Schedule every day at midnight UTC
    'delete-expired-logs': {
        'task': 'kobo.apps.audit_log.tasks.spawn_logs_cleaning_tasks',
        'schedule': crontab(minute=0, hour=0),
        'options': {'queue': 'kpi_low_priority_queue'}
    },
    # Schedule every day at midnight UTC
    'delete-expired-access-logs': {
        'task': 'kobo.apps.audit_log.tasks.spawn_access_log_cleaning_tasks',
        'schedule': crontab(minute=0, hour=0),
        'options': {'queue': 'kpi_low_priority_queue'}
    },
    # Schedule every 15 minutes
    'long-running-migrations': {
        'task': 'kobo.apps.long_running_migrations.tasks.execute_long_running_migrations',  # noqa
        'schedule': crontab(minute='*/15'),
        'options': {'queue': 'kpi_low_priority_queue'}
    },
    # Schedule every day at midnight UTC
    'mass-email-record-mark-as-failed': {
        'task': 'kobo.apps.mass_emails.tasks.mark_old_enqueued_mass_email_record_as_failed', # noqa
        'schedule': crontab(minute=0, hour=0),
        'options': {'queue': 'kpi_low_priority_queue'}
    },
    'mass-emails-send': {
        'task': 'kobo.apps.mass_emails.tasks.send_emails',
        'schedule': crontab(minute=1),
        'options': {'queue': 'kpi_queue'},
    },
    'mass-emails-enqueue-records': {
        'task': 'kobo.apps.mass_emails.tasks.generate_mass_email_user_lists',
        'schedule': crontab(minute=0),
        'options': {'queue': 'kpi_queue'},
    },
    'fix-stale-submissions-suspended-flag': {
        'task': (
            'kobo.apps.openrosa.apps.logger.tasks.fix_stale_submissions_suspended_flag'
        ),
        'schedule': crontab(minute='*/15', hour='2-5', day_of_week=0),
        'description': (
            'Unlock accounts locked by `sync_storage_counters` task'
        ),
        'options': {'queue': 'kpi_long_running_tasks_queue'},
    },
    'sync-storage-counters': {
        'task': 'kobo.apps.openrosa.apps.logger.tasks.sync_storage_counters',
        'schedule': crontab(minute=30, hour=0, day_of_week=0),
        'description': (
            'Synchronize out of sync attachment storage bytes of profile and projects'
        ),
        'options': {'queue': 'kpi_long_running_tasks_queue'},
    },
    'retry-stalled-submissions': {
        'task': 'kobo.apps.hook.tasks.retry_stalled_pending_submissions',
        'schedule': crontab(minute='*/30'),  # Every 30 minutes
    },
    'mark-zombie-submissions': {
        'task': 'kobo.apps.hook.tasks.mark_zombie_processing_submissions',
        'schedule': crontab(minute='*/30'),  # Every 30 minutes
    },
}

if STRIPE_ENABLED:
    # Schedule to run once per celery timeout
    # with a five minute buffer
    minute_interval = (CELERY_TASK_TIME_LIMIT + (60 * 5)) // 60

    CELERY_BEAT_SCHEDULE['update-exceeded-limit-counters'] = {
        'task': 'kobo.apps.stripe.tasks.update_exceeded_limit_counters',
        'schedule': crontab(minute='*/' + str(minute_interval)),
        'options': {'queue': 'kpi_low_priority_queue'},
    }

CELERY_BROKER_TRANSPORT_OPTIONS = {
    'fanout_patterns': True,
    'fanout_prefix': True,
    # http://docs.celeryproject.org/en/latest/getting-started/brokers/redis.html#redis-visibility-timeout
    # TODO figure out how to pass `Constance.HOOK_MAX_RETRIES` or `HookLog.get_remaining_seconds()
    # Otherwise hardcode `HOOK_MAX_RETRIES` in Settings
    'visibility_timeout': 60 * (10**2),  # Longest ETA for RestService (seconds)
}

CELERY_TASK_DEFAULT_QUEUE = 'kpi_queue'

CELERY_BROKER_URL = os.environ.get(
    'CELERY_BROKER_URL',
    os.environ.get('KPI_BROKER_URL', 'redis://change-me.invalid:6379/1'),
)
if 'KPI_BROKER_URL' in os.environ:
    warnings.warn(
        'KPI_BROKER_URL is renamed CELERY_BROKER_URL, update the environment variable.',
        DeprecationWarning,
    )

CELERY_RESULT_BACKEND = CELERY_BROKER_URL

# Increase limits for long-running tasks
# Notes: They are custom name, not part of `CELERY_*` namespace.
CELERY_LONG_RUNNING_TASK_TIME_LIMIT = int(
    os.environ.get('CELERY_LONG_RUNNING_TASK_TIME_LIMIT', 4260)  # seconds
)

CELERY_LONG_RUNNING_TASK_SOFT_TIME_LIMIT = int(
    os.environ.get('CELERY_LONG_RUNNING_TASK_SOFT_TIME_LIMIT', 4200)  # seconds
)

""" Django allauth configuration """
# User.email should continue to be used instead of the EmailAddress model
ACCOUNT_ADAPTER = 'kobo.apps.accounts.adapter.AccountAdapter'
ACCOUNT_USERNAME_VALIDATORS = 'kobo.apps.accounts.validators.username_validators'
ACCOUNT_SIGNUP_FIELDS = ['email*', 'username*', 'password1*', 'password2*']
ACCOUNT_EMAIL_UNKNOWN_ACCOUNTS = False
ACCOUNT_EMAIL_VERIFICATION = env.str('ACCOUNT_EMAIL_VERIFICATION', 'mandatory')
ACCOUNT_FORMS = {
    'login': 'kobo.apps.accounts.forms.LoginForm',
    'signup': 'kobo.apps.accounts.forms.SignupForm',
}
ACCOUNT_LOGIN_ON_EMAIL_CONFIRMATION = True
ACCOUNT_AUTHENTICATED_LOGIN_REDIRECTS = False
ACCOUNT_UNIQUE_EMAIL = False
ACCOUNT_RATE_LIMITS = False
ACCOUNT_SESSION_REMEMBER = True
SOCIALACCOUNT_EMAIL_VERIFICATION = env.str('SOCIALACCOUNT_EMAIL_VERIFICATION', 'none')
SOCIALACCOUNT_AUTO_SIGNUP = False
SOCIALACCOUNT_FORMS = {
    'signup': 'kobo.apps.accounts.forms.SocialSignupForm',
}


WEBPACK_LOADER = {
    'DEFAULT': {
        'BUNDLE_DIR_NAME': 'jsapp/compiled/',
        'POLL_INTERVAL': 0.5,  # seconds
        'TIMEOUT': 5,  # seconds
    }
}


""" Email configuration """
# This setting sets the prefix in the subject line of the account activation email
# The default is the URL of the server. Set to blank to fit the email requirements
ACCOUNT_EMAIL_SUBJECT_PREFIX = ''

EMAIL_BACKEND = os.environ.get(
    'EMAIL_BACKEND', 'django.core.mail.backends.filebased.EmailBackend'
)

if EMAIL_BACKEND == 'django.core.mail.backends.filebased.EmailBackend':
    EMAIL_FILE_PATH = os.environ.get(
        'EMAIL_FILE_PATH', os.path.join(BASE_DIR, 'emails'))
    if not os.path.isdir(EMAIL_FILE_PATH):
        os.mkdir(EMAIL_FILE_PATH)

if EMAIL_BACKEND == 'django.core.mail.backends.smtp.EmailBackend':
    EMAIL_BACKEND = 'kpi.utils.mailer.EmailBackend'

if os.environ.get('EMAIL_HOST'):
    EMAIL_HOST = os.environ.get('EMAIL_HOST')

if os.environ.get('EMAIL_HOST_USER'):
    EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER')
    EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD')

if os.environ.get('EMAIL_PORT'):
    EMAIL_PORT = os.environ.get('EMAIL_PORT')

if os.environ.get('EMAIL_USE_TLS'):
    EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS')

MAX_MASS_EMAILS_PER_DAY = 1
MASS_EMAIL_THROTTLE_PER_SECOND = 40
MASS_EMAIL_SLEEP_SECONDS = 1
# change the interval between "daily" email sends for testing. this will set both
# the frequency of the task and the expiry time of the cached email limits. should
# only be True on small testing instances
MASS_EMAILS_CONDENSE_SEND = env.bool('MASS_EMAILS_CONDENSE_SEND', False)
if MASS_EMAILS_CONDENSE_SEND:
    CELERY_BEAT_SCHEDULE['mass-emails-send'] = {
        'task': 'kobo.apps.mass_emails.tasks.send_emails',
        'schedule': crontab(minute='1-59/5'),
        'options': {'queue': 'kpi_queue'},
    }
    CELERY_BEAT_SCHEDULE['mass-emails-enqueue-records'] = {
        'task': 'kobo.apps.mass_emails.tasks.generate_mass_email_user_lists',
        'schedule': crontab(minute='*/5'),
        'options': {'queue': 'kpi_queue'},
    }

""" AWS configuration (email and storage) """
if env.str('AWS_ACCESS_KEY_ID', False):
    AWS_ACCESS_KEY_ID = env.str('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = env.str('AWS_SECRET_ACCESS_KEY')
    AWS_BEDROCK_REGION_NAME = env.str('AWS_BEDROCK_REGION_NAME', None)
    AWS_SES_REGION_NAME = env.str('AWS_SES_REGION_NAME', None)
    AWS_SES_REGION_ENDPOINT = env.str('AWS_SES_REGION_ENDPOINT', None)

    AWS_S3_SIGNATURE_VERSION = env.str('AWS_S3_SIGNATURE_VERSION', 's3v4')
    # Only set the region if it is present in environment.
    if region := env.str('AWS_S3_REGION_NAME', False):
        AWS_S3_REGION_NAME = region

AWS_SES_CONFIGURATION_SET = env.str('AWS_SES_CONFIGURATION_SET', None)

# Storage configuration
STORAGES = global_settings.STORAGES

default_file_storage = env.str(
    'DEFAULT_FILE_STORAGE', env.str('KPI_DEFAULT_FILE_STORAGE', None)
)
if 'KPI_DEFAULT_FILE_STORAGE' in os.environ:
    warnings.warn(
        'KPI_DEFAULT_FILE_STORAGE is renamed DEFAULT_FILE_STORAGE, '
        'update the environment variable.',
        DeprecationWarning,
    )

# ToDo Find out why `private_storage.appconfig.PRIVATE_STORAGE_CLASS`
#  cannot be imported. Otherwise, some tests are failing.
# from private_storage.appconfig import (
#   PRIVATE_STORAGE_CLASS as DEFAULT_PRIVATE_STORAGE_CLASS
# )
# PRIVATE_STORAGE_CLASS = DEFAULT_PRIVATE_STORAGE_CLASS
PRIVATE_STORAGE_CLASS = 'private_storage.storage.files.PrivateFileSystemStorage'

if default_file_storage:

    global_default_file_storage = STORAGES['default']['BACKEND']
    default_file_storage = STORAGES['default']['BACKEND'] = default_file_storage

    if default_file_storage != global_default_file_storage:
        if default_file_storage.endswith('S3Boto3Storage'):
            # To use S3 storage, set this to `kobo.apps.storage_backends.s3boto3.S3Boto3Storage`
            # Force usage of custom S3 tellable Storage
            STORAGES['default']['BACKEND'] = (
                'kobo.apps.storage_backends.s3boto3.S3Boto3Storage'
            )
            AWS_S3_FILE_OVERWRITE = False
        elif default_file_storage.endswith('AzureStorage'):
            PRIVATE_STORAGE_CLASS = (
                'kobo.apps.storage_backends.private_azure_storage.PrivateAzureStorage'
            )
            PRIVATE_STORAGE_S3_REVERSE_PROXY = True  # Yes S3
            AZURE_ACCOUNT_NAME = env.str('AZURE_ACCOUNT_NAME')
            AZURE_ACCOUNT_KEY = env.str('AZURE_ACCOUNT_KEY')
            AZURE_CONTAINER = env.str('AZURE_CONTAINER')
            AZURE_URL_EXPIRATION_SECS = env.int(
                'AZURE_URL_EXPIRATION_SECS', None
            )

    aws_storage_bucket_name = env.str(
        'AWS_STORAGE_BUCKET_NAME', env.str('KPI_AWS_STORAGE_BUCKET_NAME', None)
    )
    if aws_storage_bucket_name:
        AWS_STORAGE_BUCKET_NAME = aws_storage_bucket_name
        AWS_DEFAULT_ACL = 'private'
        # django-private-storage needs its own S3 configuration
        PRIVATE_STORAGE_CLASS = (
            'private_storage.storage.s3boto3.PrivateS3BotoStorage'
            # NB.........There's intentionally no 3 here! ^
        )
        AWS_PRIVATE_STORAGE_BUCKET_NAME = AWS_STORAGE_BUCKET_NAME
        # Proxy S3 through our application instead of redirecting to bucket
        # URLs with query parameter authentication
        PRIVATE_STORAGE_S3_REVERSE_PROXY = True

if 'KOBOCAT_DEFAULT_FILE_STORAGE' in os.environ:
    KOBOCAT_DEFAULT_FILE_STORAGE = os.environ.get('KOBOCAT_DEFAULT_FILE_STORAGE')
    if 'KOBOCAT_AWS_STORAGE_BUCKET_NAME' in os.environ:
        KOBOCAT_AWS_STORAGE_BUCKET_NAME = os.environ.get('KOBOCAT_AWS_STORAGE_BUCKET_NAME')
        STORAGES['local'] = {
            'BACKEND': 'django.core.files.storage.FileSystemStorage',
        }
else:
    KOBOCAT_DEFAULT_FILE_STORAGE = global_settings.STORAGES['default']['BACKEND']
    KOBOCAT_MEDIA_ROOT = os.environ.get(
        'KOBOCAT_MEDIA_ROOT', MEDIA_ROOT.replace('kpi', 'kobocat')
    )

STORAGES['import_export_celery'] = {'BACKEND': PRIVATE_STORAGE_CLASS}

# Google Cloud Storage
# Not fully supported as a generic storage backend
GS_BUCKET_NAME = env.str('GS_BUCKET_NAME', None)


""" Django error logging configuration """
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '%(levelname)s %(asctime)s %(module)s' +
                      ' %(process)d %(thread)d %(message)s'
        },
        'simple': {
            'format': '%(levelname)s %(message)s'
        },
    },
    'handlers': {
        'console': {
            'level': 'DEBUG',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose'
        }
    },
    'loggers': {
        'console_logger': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': True
        },
        'django.db.backends': {
            'level': 'ERROR',
            'handlers': ['console'],
            'propagate': True
        },
    }
}


################################
# Sentry settings              #
################################
sentry_dsn = env.str('SENTRY_DSN', None)
if sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration

    # All of this is already happening by default!
    sentry_logging = LoggingIntegration(
        level=logging.INFO,  # Capture info and above as breadcrumbs
        event_level=logging.WARNING  # Send warnings as events
    )
    sentry_sdk.init(
        dsn=sentry_dsn,
        integrations=[
            DjangoIntegration(),
            CeleryIntegration(),
            sentry_logging
        ],
        traces_sample_rate=env.float('SENTRY_TRACES_SAMPLE_RATE', 0.01),
        send_default_pii=True
    )


if ENABLE_METRICS := env.bool('ENABLE_METRICS', False):
    MIDDLEWARE.insert(0, 'django_prometheus.middleware.PrometheusBeforeMiddleware')
    MIDDLEWARE.append('django_prometheus.middleware.PrometheusAfterMiddleware')
# Workaround https://github.com/korfuri/django-prometheus/issues/34
PROMETHEUS_EXPORT_MIGRATIONS = False
# https://github.com/korfuri/django-prometheus/blob/master/documentation/exports.md#exporting-metrics-in-a-wsgi-application-with-multiple-processes-per-process
if start_port := env.int('METRICS_START_PORT', None):
    PROMETHEUS_METRICS_EXPORT_PORT_RANGE = range(
        start_port, env.int('METRICS_END_PORT', start_port + 10)
    )


""" Try to identify the running codebase for informational purposes """
# Based upon https://github.com/tblobaum/git-rev/blob/master/index.js
GIT_REV = {}
for git_rev_key, git_command in (
        ('short', ('git', 'rev-parse', '--short', 'HEAD')),
        ('long', ('git', 'rev-parse', 'HEAD')),
        ('branch', ('git', 'rev-parse', '--abbrev-ref', 'HEAD')),
        ('tag', ('git', 'describe', '--exact-match', '--tags')),
):
    try:
        GIT_REV[git_rev_key] = subprocess.check_output(
            git_command, stderr=subprocess.STDOUT).strip()
    except (OSError, subprocess.CalledProcessError) as e:
        GIT_REV[git_rev_key] = False
if GIT_REV['branch'] == 'HEAD':
    GIT_REV['branch'] = False


"""
Since this project handles user creation, we must handle the model-level
permission assignment that would've been done by KoBoCAT's user post_save
signal handler. Here we record the content types of the models listed in KC's
deprecated function set_api_permissions_for_user.
TODO: This is being refactored and is pending to clean up
"""
KOBOCAT_DEFAULT_PERMISSION_CONTENT_TYPES = [
    # Each tuple must be (app_label, model_name)
    ('main', 'userprofile'),
    ('logger', 'xform'),
    ('logger', 'note'),
]

# A flag set by unit tests to bypass KoBoCAT user syncing
TESTING = False


""" Auxiliary database configuration """
if not (MONGO_DB_URL := env.str('MONGO_DB_URL', False)):
    # ToDo Remove all this block by the end of 2022.
    #   Update kobo-install accordingly
    logging.warning(
        '`MONGO_DB_URL` is not found. '
        '`KPI_MONGO_HOST`, `KPI_MONGO_PORT`, `KPI_MONGO_NAME`, '
        '`KPI_MONGO_USER`, `KPI_MONGO_PASS` '
        'are deprecated and will not be supported anymore soon.'
    )

    MONGO_DATABASE = {
        'HOST': os.environ.get('KPI_MONGO_HOST', 'mongo'),
        'PORT': int(os.environ.get('KPI_MONGO_PORT', 27017)),
        'NAME': os.environ.get('KPI_MONGO_NAME', 'formhub'),
        'USER': os.environ.get('KPI_MONGO_USER', ''),
        'PASSWORD': os.environ.get('KPI_MONGO_PASS', '')
    }

    if MONGO_DATABASE.get('USER') and MONGO_DATABASE.get('PASSWORD'):
        MONGO_DB_URL = 'mongodb://{user}:{password}@{host}:{port}/{db_name}'.format(
            user=MONGO_DATABASE['USER'],
            password=quote_plus(MONGO_DATABASE['PASSWORD']),
            host=MONGO_DATABASE['HOST'],
            port=MONGO_DATABASE['PORT'],
            db_name=MONGO_DATABASE['NAME'],
        )
    else:
        MONGO_DB_URL = 'mongodb://%(HOST)s:%(PORT)s/%(NAME)s' % MONGO_DATABASE
    mongo_db_name = MONGO_DATABASE['NAME']
else:
    # Attempt to get collection name from the connection string
    # fallback on MONGO_DB_NAME or 'formhub' if it is empty or None or unable to parse
    try:
        mongo_db_name = env.db_url('MONGO_DB_URL').get('NAME') or env.str('MONGO_DB_NAME', 'formhub')
    except ValueError:  # db_url is unable to parse replica set strings
        mongo_db_name = env.str('MONGO_DB_NAME', 'formhub')

mongo_client = MongoClient(
    MONGO_DB_URL, connect=False, journal=True, tz_aware=True
)
MONGO_DB = mongo_client[mongo_db_name]

# If a request or task makes a database query and then times out, the database
# server should not spin forever attempting to fulfill that query.
# ⚠️⚠️
# These settings should never be used directly.
# Use MongoHelper.get_max_time_ms() in the code instead
# ⚠️⚠️
MONGO_QUERY_TIMEOUT = SYNCHRONOUS_REQUEST_TIME_LIMIT + 5  # seconds
MONGO_CELERY_QUERY_TIMEOUT = CELERY_TASK_TIME_LIMIT + 10  # seconds


SESSION_ENGINE = 'redis_sessions.session'
# django-redis-session expects a dictionary with `url`
redis_session_url = env.cache_url(
    'REDIS_SESSION_URL', default='redis://change-me.invalid:6380/2'
)
SESSION_REDIS = {
    'url': redis_session_url['LOCATION'],
    'prefix': env.str('REDIS_SESSION_PREFIX', 'session'),
    'socket_timeout': env.int('REDIS_SESSION_SOCKET_TIMEOUT', 1),
}

CACHES = {
    # Set CACHE_URL to override
    'default': env.cache_url(default='redis://change-me.invalid:6380/3'),
    'enketo_redis_main': env.cache_url(
        'ENKETO_REDIS_MAIN_URL', default='redis://change-me.invalid/0'
    ),
}

# How long to retain cached responses for kpi endpoints
ENDPOINT_CACHE_DURATION = env.int('ENDPOINT_CACHE_DURATION', 60 * 15)  # 15 minutes

ENV = None

# The maximum size in bytes that a request body may be before a
# SuspiciousOperation (RequestDataTooBig) is raised
DATA_UPLOAD_MAX_MEMORY_SIZE = 10485760

# The maximum size (in bytes) that an upload will be before it gets streamed
# to the file system
FILE_UPLOAD_MAX_MEMORY_SIZE = 10485760

# OpenRosa setting in bytes
OPENROSA_DEFAULT_CONTENT_LENGTH = 10000000

# Expiration time in sec. after which paired data xml file must be regenerated
PAIRED_DATA_EXPIRATION = 300  # seconds

CALCULATED_HASH_CACHE_EXPIRATION = 300  # seconds

# add some mimetype
add_type('application/wkt', '.wkt')
add_type('application/geo+json', '.geojson')

KOBOCAT_MEDIA_URL = f'{KOBOCAT_URL}/media/'

MFA_FORMS = {
    'authenticate': 'kobo.apps.accounts.mfa.forms.MfaAuthenticateForm',
    'reauthenticate': 'kobo.apps.accounts.mfa.forms.MfaReauthenticateForm',
}
MFA_ADAPTER = 'kobo.apps.accounts.mfa.adapter.MfaAdapter'
MFA_TOTP_DIGITS = env.int('MFA_CODE_LENGTH', 6)
MFA_TOTP_PERIOD = env.int('MFA_CODE_VALIDITY_PERIOD', 30)
MFA_RECOVERY_CODE_COUNT = 5
MFA_RECOVERY_CODE_DIGITS = 12

TRENCH_AUTH = {
    'USER_MFA_MODEL': 'accounts_mfa.MfaMethod',
    'USER_ACTIVE_FIELD': 'is_active',
    'BACKUP_CODES_QUANTITY': 5,
    'BACKUP_CODES_LENGTH': 12,  # keep (quantity * length) under 200
    'BACKUP_CODES_CHARACTERS': (string.ascii_letters + string.digits),
    'DEFAULT_VALIDITY_PERIOD': 30,
    'ENCRYPT_BACKUP_CODES': True,
    'SECRET_KEY_LENGTH': 32,
    'CONFIRM_DISABLE_WITH_CODE': True,
    'CONFIRM_BACKUP_CODES_REGENERATION_WITH_CODE': True,
    'ALLOW_BACKUP_CODES_REGENERATION': True,
    'MFA_METHODS': {
        'app': {
            'VERBOSE_NAME': 'app',
            'VALIDITY_PERIOD': env.int(
                'MFA_CODE_VALIDITY_PERIOD', 30  # seconds
            ),
            'USES_THIRD_PARTY_CLIENT': True,
            'HANDLER': 'kobo.apps.accounts.mfa.backends.application.ApplicationBackend',
        },
    },
    'CODE_LENGTH': env.int('MFA_CODE_LENGTH', 6),
}


# Session Authentication is supported by default.
MFA_SUPPORTED_AUTH_CLASSES = [
    'kpi.authentication.TokenAuthentication',
    'kobo.apps.openrosa.libs.authentication.TokenAuthentication',
]

MINIMUM_DEFAULT_SEARCH_CHARACTERS = 3

# Django 3.2 required settings
DEFAULT_AUTO_FIELD = 'django.db.models.AutoField'

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'kpi.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'kpi.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'kpi.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'kpi.password_validation.CustomRulesValidator',
    },
    {
        'NAME': 'kpi.password_validation.MostRecentPasswordValidator',
    },
]

# Needed to avoid Constance to create permissions on KoboCAT database
CONSTANCE_DBS = [
    'default'
]

AUTH_USER_MODEL = 'kobo_auth.User'

####################################
#         KoboCAT settings         #
####################################
KOBOCAT_PUBLIC_HOSTNAME = (
    f"{env.str('KOBOCAT_PUBLIC_SUBDOMAIN', 'kc')}"
    f".{env.str('PUBLIC_DOMAIN_NAME', 'domain.tld')}"
)

KOBOFORM_INTERNAL_URL = env.url('KOBOFORM_INTERNAL_URL', KOBOFORM_URL).geturl()

ENKETO_OFFLINE_SURVEYS = env.bool('ENKETO_OFFLINE_SURVEYS', True)
ENKETO_ONLINE_SURVEY_ENDPOINT = 'api/v2/survey'
ENKETO_OFFLINE_SURVEY_ENDPOINT = 'api/v2/survey/offline'
OPENROSA_ENKETO_SURVEY_ENDPOINT = (
    ENKETO_OFFLINE_SURVEY_ENDPOINT
    if ENKETO_OFFLINE_SURVEYS
    else ENKETO_ONLINE_SURVEY_ENDPOINT
)
OPENROSA_APP_DIR = os.path.join(BASE_DIR, 'kobo', 'apps', 'openrosa')
DEFAULT_SESSION_EXPIRY_TIME = 21600  # 6 hours

CELERY_TASK_ROUTES = {
    'kobo.apps.openrosa.*': 'kobocat_queue',
}
USE_THOUSAND_SEPARATOR = True

DIGEST_NONCE_BACKEND = 'kobo.apps.openrosa.apps.django_digest_backends.cache.RedisCacheNonceStorage'  # noqa

KPI_HOOK_ENDPOINT_PATTERN = '/api/v2/assets/{asset_uid}/hook-signal/'

# TODO Validate if `'PKCE_REQUIRED': False` is required in KPI
OAUTH2_PROVIDER = {
    # this is the list of available scopes
    'SCOPES': {
        'read': 'Read scope',
        'write': 'Write scope',
        'groups': 'Access to your groups'
    },
    'PKCE_REQUIRED': False,
}

REVERSION_MIDDLEWARE_SKIPPED_URL_PATTERNS = {
    r'/api/v1/users/(.*)': ['DELETE']
}
DAILY_COUNTERS_MAX_DAYS = env.int('DAILY_COUNTERS_MAX_DAYS', 366)

USE_POSTGRESQL = True

# Added this because of https://github.com/onaio/kobo.apps.open_rosa_server/pull/2139
# Should bring support to ODK v1.17+
SUPPORT_BRIEFCASE_SUBMISSION_DATE = (
    os.environ.get('SUPPORT_BRIEFCASE_SUBMISSION_DATE') != 'True'
)

DEFAULT_VALIDATION_STATUSES = {
    'validation_status_not_approved': 'Not Approved',
    'validation_status_approved': 'Approved',
    'validation_status_on_hold': 'On Hold',
}

THUMB_CONF = {
    'large': 1280,
    'medium': 640,
    'small': 240,
}

SUPPORTED_MEDIA_UPLOAD_TYPES = [
    'image/jpeg',
    'image/png',
    'image/svg+xml',
    'image/webp',
    'video/3gpp',
    'video/mp4',
    'video/quicktime',
    'video/ogg',
    'video/webm',
    'audio/aac',
    'audio/aacp',
    'audio/3gpp',
    'audio/flac',
    'audio/mp3',
    'audio/mp4',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav',
    'audio/x-wav',
    'audio/webm',
    'audio/x-m4a',
    'text/csv',
    'application/xml',
    'application/zip',
    'application/x-zip-compressed',
    'application/geo+json',
]

DIGEST_LOGIN_FACTORY = 'django_digest.NoEmailLoginFactory'

# Admins will not be explicitly granted these permissions, (i.e., not referenced
# in the ObjectPermission table), but the code will still conduct the permission
# checks as if they were.
ADMIN_ORG_INHERITED_PERMS = [PERM_DELETE_ASSET, PERM_MANAGE_ASSET]


# Import/Export Celery
IMPORT_EXPORT_CELERY_INIT_MODULE = 'kobo.celery'

IMPORT_EXPORT_CELERY_MODELS = {
    'OrganizationUser': {
        'app_label': 'organization',
        'model_name': 'OrganizationUser',
    },
}

IMPORT_EXPORT_CELERY_STORAGE_ALIAS = 'import_export_celery'

ORG_INVITATION_RESENT_RESET_AFTER = 15 * 60  # in seconds

# Batch sizes
DEFAULT_BATCH_SIZE = 1000
LOG_DELETION_BATCH_SIZE = 1000
USER_ASSET_ORG_TRANSFER_BATCH_SIZE = 1000
SUBMISSION_DELETION_BATCH_SIZE = 1000
LONG_RUNNING_MIGRATION_BATCH_SIZE = 2000
VERSION_DELETION_BATCH_SIZE = 2000

# Number of stuck tasks should be restarted at a time
MAX_RESTARTED_TASKS = 100
MAX_RESTARTED_TRANSFERS = 20

# Maximum timeout (in minutes) for hook processing
HOOK_PROCESSING_TIMEOUT = 120
