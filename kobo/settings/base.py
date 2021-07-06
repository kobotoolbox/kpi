# coding: utf-8
import multiprocessing
import os
import subprocess
from mimetypes import add_type
from datetime import timedelta
from urllib.parse import quote_plus

import dj_database_url
import django.conf.locale
from celery.schedules import crontab
from django.conf.global_settings import LOGIN_URL
from django.urls import reverse_lazy
from django.utils.translation import get_language_info
from pymongo import MongoClient

from kpi.utils.redis_helper import RedisHelper
from ..static_lists import EXTRA_LANG_INFO

# Build paths inside the project like this: os.path.join(BASE_DIR, ...)
settings_dirname = os.path.dirname(os.path.abspath(__file__))
parent_dirname = os.path.dirname(settings_dirname)
BASE_DIR = os.path.abspath(os.path.dirname(parent_dirname))


# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', '@25)**hc^rjaiagb4#&q*84hr*uscsxwr-cv#0joiwj$))obyk')

# Optionally treat proxied connections as secure.
# See: https://docs.djangoproject.com/en/1.8/ref/settings/#secure-proxy-ssl-header.
# Example environment: `export SECURE_PROXY_SSL_HEADER='HTTP_X_FORWARDED_PROTO, https'`.
# SECURITY WARNING: If enabled, outer web server must filter out the `X-Forwarded-Proto` header.
if 'SECURE_PROXY_SSL_HEADER' in os.environ:
    SECURE_PROXY_SSL_HEADER = tuple((substring.strip() for substring in
                                     os.environ['SECURE_PROXY_SSL_HEADER'].split(',')))

if (
    os.environ.get('PUBLIC_REQUEST_SCHEME', '').lower() == 'https'
    or 'SECURE_PROXY_SSL_HEADER' in os.environ
):
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

# Make Django use NginX $host. Useful when running with ./manage.py runserver_plus
# It avoids adding the debugger webserver port (i.e. `:8000`) at the end of urls.
if os.getenv("USE_X_FORWARDED_HOST", "False") == "True":
    USE_X_FORWARDED_HOST = True

# Domain must not exclude KoBoCAT when sharing sessions
if os.environ.get('SESSION_COOKIE_DOMAIN'):
    SESSION_COOKIE_DOMAIN = os.environ['SESSION_COOKIE_DOMAIN']
    SESSION_COOKIE_NAME = 'kobonaut'

# Limit sessions to 1 week (the default is 2 weeks)
SESSION_COOKIE_AGE = 604800

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = (os.environ.get('DJANGO_DEBUG', 'False') == 'True')

ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', '*').split(' ')

LOGIN_REDIRECT_URL = '/'

# Application definition

# The order of INSTALLED_APPS is important for template resolution. When two
# apps both define templates for the same view, the first app listed receives
# precedence
INSTALLED_APPS = (
    # Always put `contenttypes` before `auth`; see
    # https://code.djangoproject.com/ticket/10827
    'django.contrib.contenttypes',
    'django.contrib.auth',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'reversion',
    'private_storage',
    'kobo.apps.KpiConfig',
    'hub',
    'loginas',
    'webpack_loader',
    'registration',         # Order is important
    'django.contrib.admin', # Must come AFTER registration
    'django_extensions',
    'taggit',
    'rest_framework',
    'rest_framework.authtoken',
    'oauth2_provider',
    'markitup',
    'django_digest',
    'kobo.apps.superuser_stats.SuperuserStatsAppConfig',
    'kobo.apps.service_health',
    'constance',
    'constance.backends.database',
    'kobo.apps.hook',
    'django_celery_beat',
    'corsheaders',
    'kobo.apps.external_integrations.ExternalIntegrationsAppConfig',
    'markdownx',
    'kobo.apps.help',
    'kobo.apps.shadow_model.ShadowModelAppConfig',
)

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.locale.LocaleMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'hub.middleware.UsernameInResponseHeaderMiddleware',
    'django_userforeignkey.middleware.UserForeignKeyMiddleware',
    'django_request_cache.middleware.RequestCacheMiddleware',
]

if os.environ.get('DEFAULT_FROM_EMAIL'):
    DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL')
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
    'TERMS_OF_SERVICE_URL': ('', 'URL for terms of service document'),
    'PRIVACY_POLICY_URL': ('', 'URL for privacy policy'),
    'SOURCE_CODE_URL': (
        'https://github.com/kobotoolbox/',
        'URL of source code repository. When empty, a link will not be shown '
        'in the user interface',
    ),
    'SUPPORT_EMAIL': (
        os.environ.get('KOBO_SUPPORT_EMAIL')
        or os.environ.get('DEFAULT_FROM_EMAIL', 'help@kobotoolbox.org'),
        'Email address for users to contact, e.g. when they encounter '
        'unhandled errors in the application',
    ),
    'SUPPORT_URL': (
        os.environ.get('KOBO_SUPPORT_URL', 'https://support.kobotoolbox.org/'),
        'URL for "KoBoToolbox Help Center"',
    ),
    'COMMUNITY_URL': (
        os.environ.get(
            'KOBO_COMMUNITY_URL', 'https://community.kobotoolbox.org/'
        ),
        'URL for "KoBoToolbox Community Forum"',
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
}
# Tell django-constance to use a database model instead of Redis
CONSTANCE_BACKEND = 'constance.backends.database.DatabaseBackend'


# Warn developers to use `pytest` instead of `./manage.py test`
class DoNotUseRunner:
    def __init__(self, *args, **kwargs):
        raise NotImplementedError('Please run tests with `pytest` instead')


TEST_RUNNER = __name__ + '.DoNotUseRunner'

# used in kpi.models.sitewide_messages
MARKITUP_FILTER = ('markdown.markdown', {'safe_mode': False})

# The backend that handles user authentication must match KoBoCAT's when
# sharing sessions. ModelBackend does not interfere with object-level
# permissions: it always denies object-specific requests (see
# https://github.com/django/django/blob/1.7/django/contrib/auth/backends.py#L44).
# KoBoCAT also lists ModelBackend before
# guardian.backends.ObjectPermissionBackend.
AUTHENTICATION_BACKENDS = (
    'django.contrib.auth.backends.ModelBackend',
    'kpi.backends.ObjectPermissionBackend',
)

ROOT_URLCONF = 'kobo.urls'

WSGI_APPLICATION = 'kobo.wsgi.application'

# What User object should be mapped to AnonymousUser?
ANONYMOUS_USER_ID = -1
# Permissions assigned to AnonymousUser are restricted to the following
ALLOWED_ANONYMOUS_PERMISSIONS = (
    'kpi.view_asset',
    'kpi.discover_asset',
    'kpi.view_submissions',
)

# run heavy migration scripts by default
# NOTE: this should be set to False for major deployments. This can take a long time
SKIP_HEAVY_MIGRATIONS = os.environ.get('SKIP_HEAVY_MIGRATIONS', 'False') == 'True'

# Database
# https://docs.djangoproject.com/en/1.7/ref/settings/#databases

DATABASES = {
    'default': dj_database_url.config(default="sqlite:///%s/db.sqlite3" % BASE_DIR),
}
kobocat_database_url = os.getenv('KC_DATABASE_URL')
if kobocat_database_url:
    DATABASES['kobocat'] = dj_database_url.parse(kobocat_database_url)

DATABASE_ROUTERS = ['kpi.db_routers.DefaultDatabaseRouter']

# Internationalization
# https://docs.djangoproject.com/en/1.8/topics/i18n/

django.conf.locale.LANG_INFO.update(EXTRA_LANG_INFO)

LANGUAGES = [
    (lang_code, get_language_info(lang_code)['name_local'])
        for lang_code in os.environ.get(
            'DJANGO_LANGUAGE_CODES', 'en').split(' ')
]

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

LOCALE_PATHS = (os.path.join(BASE_DIR, 'locale'),)

USE_I18N = True

USE_L10N = True

USE_TZ = True

CAN_LOGIN_AS = lambda request, target_user: request.user.is_superuser

# Impose a limit on the number of records returned by the submission list
# endpoint. This overrides any `?limit=` query parameter sent by a client
SUBMISSION_LIST_LIMIT = 30000

# REMOVE the oldest if a user exceeds this many exports for a particular form
MAXIMUM_EXPORTS_PER_USER_PER_FORM = 10

# Private media file configuration
PRIVATE_STORAGE_ROOT = os.path.join(BASE_DIR, 'media')
PRIVATE_STORAGE_AUTH_FUNCTION = \
    'kpi.utils.private_storage.superuser_or_username_matches_prefix'

# django-markdownx, for in-app messages
MARKDOWNX_UPLOAD_URLS_PATH = reverse_lazy('in-app-message-image-upload')
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
KPI_PREFIX = os.environ.get('KPI_PREFIX', 'False')
if KPI_PREFIX.lower() == 'false':
    KPI_PREFIX = False
else:
    KPI_PREFIX = '/' + KPI_PREFIX.strip('/')

# KPI_PREFIX should be set in the environment when running in a subdirectory
if KPI_PREFIX and KPI_PREFIX != '/':
    STATIC_URL = KPI_PREFIX + '/' + STATIC_URL.lstrip('/')
    MEDIA_URL = KPI_PREFIX + '/' + MEDIA_URL.lstrip('/')
    LOGIN_URL = KPI_PREFIX + '/' + LOGIN_URL.lstrip('/')
    LOGIN_REDIRECT_URL = KPI_PREFIX + '/' + LOGIN_REDIRECT_URL.lstrip('/')

STATICFILES_DIRS = (
    os.path.join(BASE_DIR, 'jsapp'),
    os.path.join(BASE_DIR, 'static'),
    ('mocha', os.path.join(BASE_DIR, 'node_modules', 'mocha'),),
    ('chai', os.path.join(BASE_DIR, 'node_modules', 'chai'),),
)

if os.path.exists(os.path.join(BASE_DIR, 'dkobo', 'jsapp')):
    STATICFILES_DIRS = STATICFILES_DIRS + (
        os.path.join(BASE_DIR, 'dkobo', 'jsapp'),
        os.path.join(BASE_DIR, 'dkobo', 'dkobo', 'static'),
    )

REST_FRAMEWORK = {
    'URL_FIELD_NAME': 'url',
    'DEFAULT_PAGINATION_CLASS': 'kpi.paginators.Paginated',
    'PAGE_SIZE': 100,
    'DEFAULT_AUTHENTICATION_CLASSES': [
        # SessionAuthentication and BasicAuthentication would be included by
        # default
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.BasicAuthentication',
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_RENDERER_CLASSES': [
       'rest_framework.renderers.JSONRenderer',
       'rest_framework.renderers.BrowsableAPIRenderer',
       'kpi.renderers.XMLRenderer',
    ],
    'DEFAULT_VERSIONING_CLASS': 'kpi.versioning.APIVersioning',
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
                'django.contrib.messages.context_processors.messages',
                # Additional processors
                'kpi.context_processors.external_service_tokens',
                'kpi.context_processors.email',
                'kpi.context_processors.sitewide_messages',
                'kpi.context_processors.config',
            ],
            'debug': os.environ.get('TEMPLATE_DEBUG', 'False') == 'True',
        },
    },
]

GOOGLE_ANALYTICS_TOKEN = os.environ.get('GOOGLE_ANALYTICS_TOKEN')
RAVEN_JS_DSN = os.environ.get('RAVEN_JS_DSN')

# replace this with the pointer to the kobocat server, if it exists
KOBOCAT_URL = os.environ.get('KOBOCAT_URL', 'http://kobocat')
KOBOCAT_INTERNAL_URL = os.environ.get('KOBOCAT_INTERNAL_URL',
                                      'http://kobocat')

KOBOFORM_URL = os.environ.get('KOBOFORM_URL', 'http://kpi')
KOBOFORM_INTERNAL_URL = os.environ.get('KOBOFORM_INTERNAL_URL', 'http://kpi')

if 'KOBOCAT_URL' in os.environ:
    DEFAULT_DEPLOYMENT_BACKEND = 'kobocat'
else:
    DEFAULT_DEPLOYMENT_BACKEND = 'mock'


''' Enketo configuration '''
ENKETO_SERVER = os.environ.get('ENKETO_URL') or os.environ.get('ENKETO_SERVER', 'https://enketo.org')
ENKETO_SERVER = ENKETO_SERVER + '/' if not ENKETO_SERVER.endswith('/') else ENKETO_SERVER
ENKETO_VERSION = os.environ.get('ENKETO_VERSION', 'Legacy').lower()
ENKETO_INTERNAL_URL = os.environ.get('ENKETO_INTERNAL_URL', ENKETO_SERVER)

# ToDo 2020-01-23 Verify if 2 lines below are still needed?
assert ENKETO_VERSION in ['legacy', 'express']
ENKETO_PREVIEW_URI = 'webform/preview' if ENKETO_VERSION == 'legacy' else 'preview'

# The number of hours to keep a kobo survey preview (generated for enketo)
# around before purging it.
KOBO_SURVEY_PREVIEW_EXPIRATION = os.environ.get('KOBO_SURVEY_PREVIEW_EXPIRATION', 24)

ENKETO_API_TOKEN = os.environ.get('ENKETO_API_TOKEN', 'enketorules')
# http://apidocs.enketo.org/v2/
ENKETO_SURVEY_ENDPOINT = 'api/v2/survey/all'
ENKETO_PREVIEW_ENDPOINT = 'api/v2/survey/preview/iframe'


''' Celery configuration '''
# Celery 4.0 New lowercase settings.
# Uppercase settings can be used when using a PREFIX
# http://docs.celeryproject.org/en/latest/userguide/configuration.html#new-lowercase-settings
# http://docs.celeryproject.org/en/4.0/whatsnew-4.0.html#step-2-update-your-configuration-with-the-new-setting-names

CELERY_TIMEZONE = "UTC"

if os.environ.get('SKIP_CELERY', 'False') == 'True':
    # helpful for certain debugging
    CELERY_TASK_ALWAYS_EAGER = True

# Celery defaults to having as many workers as there are cores. To avoid
# excessive resource consumption, don't spawn more than 6 workers by default
# even if there more than 6 cores.

CELERYD_MAX_CONCURRENCY = int(os.environ.get('CELERYD_MAX_CONCURRENCY', 6))
if multiprocessing.cpu_count() > CELERYD_MAX_CONCURRENCY:
    CELERY_WORKER_CONCURRENCY = CELERYD_MAX_CONCURRENCY

# Replace a worker after it completes 7 tasks by default. This allows the OS to
# reclaim memory allocated during large tasks
CELERY_WORKER_MAX_TASKS_PER_CHILD = int(os.environ.get(
    'CELERYD_MAX_TASKS_PER_CHILD', 7))

# Default to a 30-minute soft time limit and a 35-minute hard time limit
CELERY_TASK_TIME_LIMIT = int(os.environ.get('CELERYD_TASK_TIME_LIMIT', 2100))

CELERY_TASK_SOFT_TIME_LIMIT = int(os.environ.get(
    'CELERYD_TASK_SOFT_TIME_LIMIT', 1800))

CELERY_BEAT_SCHEDULE = {
    # Schedule every day at midnight UTC. Can be customized in admin section
    "send-hooks-failures-reports": {
        "task": "kobo.apps.hook.tasks.failures_reports",
        "schedule": crontab(hour=0, minute=0),
        'options': {'queue': 'kpi_queue'}
    },
}

CELERY_BROKER_TRANSPORT_OPTIONS = {
    "fanout_patterns": True,
    "fanout_prefix": True,
    # http://docs.celeryproject.org/en/latest/getting-started/brokers/redis.html#redis-visibility-timeout
    # TODO figure out how to pass `Constance.HOOK_MAX_RETRIES` or `HookLog.get_remaining_seconds()
    # Otherwise hardcode `HOOK_MAX_RETRIES` in Settings
    "visibility_timeout": 60 * (10 ** 3)  # Longest ETA for RestService
}

CELERY_TASK_DEFAULT_QUEUE = "kpi_queue"

if 'KOBOCAT_URL' in os.environ:
    SYNC_KOBOCAT_XFORMS = (os.environ.get('SYNC_KOBOCAT_XFORMS', 'True') == 'True')
    SYNC_KOBOCAT_PERMISSIONS = (
        os.environ.get('SYNC_KOBOCAT_PERMISSIONS', 'True') == 'True')
    if SYNC_KOBOCAT_XFORMS:
        # Create/update KPI assets to match KC forms
        SYNC_KOBOCAT_XFORMS_PERIOD_MINUTES = int(
            os.environ.get('SYNC_KOBOCAT_XFORMS_PERIOD_MINUTES', '30'))
        CELERY_BEAT_SCHEDULE['sync-kobocat-xforms'] = {
            'task': 'kpi.tasks.sync_kobocat_xforms',
            'schedule': timedelta(minutes=SYNC_KOBOCAT_XFORMS_PERIOD_MINUTES),
            'options': {'queue': 'sync_kobocat_xforms_queue',
                        'expires': SYNC_KOBOCAT_XFORMS_PERIOD_MINUTES / 2. * 60},
        }

CELERY_BROKER_URL = os.environ.get('KPI_BROKER_URL', 'redis://localhost:6379/1')
CELERY_RESULT_BACKEND = CELERY_BROKER_URL


''' Django Registration configuration '''
# http://django-registration-redux.readthedocs.org/en/latest/quickstart.html#settings
ACCOUNT_ACTIVATION_DAYS = 3
REGISTRATION_AUTO_LOGIN = True
REGISTRATION_EMAIL_HTML = False  # Otherwise we have to write HTML templates

WEBPACK_LOADER = {
    'DEFAULT': {
        'BUNDLE_DIR_NAME': 'jsapp/compiled/',
        'POLL_INTERVAL': 0.5,
        'TIMEOUT': 5,
    }
}


''' Email configuration '''
EMAIL_BACKEND = os.environ.get('EMAIL_BACKEND',
                               'django.core.mail.backends.filebased.EmailBackend')

if EMAIL_BACKEND == 'django.core.mail.backends.filebased.EmailBackend':
    EMAIL_FILE_PATH = os.environ.get(
        'EMAIL_FILE_PATH', os.path.join(BASE_DIR, 'emails'))
    if not os.path.isdir(EMAIL_FILE_PATH):
        os.mkdir(EMAIL_FILE_PATH)

if os.environ.get('EMAIL_HOST'):
    EMAIL_HOST = os.environ.get('EMAIL_HOST')

if os.environ.get('EMAIL_HOST_USER'):
    EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER')
    EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD')

if os.environ.get('EMAIL_PORT'):
    EMAIL_PORT = os.environ.get('EMAIL_PORT')

if os.environ.get('EMAIL_USE_TLS'):
    EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS')


''' AWS configuration (email and storage) '''
if os.environ.get('AWS_ACCESS_KEY_ID'):
    AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
    AWS_SES_REGION_NAME = os.environ.get('AWS_SES_REGION_NAME')
    AWS_SES_REGION_ENDPOINT = os.environ.get('AWS_SES_REGION_ENDPOINT')


''' Storage configuration '''
if 'KPI_DEFAULT_FILE_STORAGE' in os.environ:
    # To use S3 storage, set this to `storages.backends.s3boto3.S3Boto3Storage`
    DEFAULT_FILE_STORAGE = os.environ.get('KPI_DEFAULT_FILE_STORAGE')
    if 'KPI_AWS_STORAGE_BUCKET_NAME' in os.environ:
        AWS_STORAGE_BUCKET_NAME = os.environ.get('KPI_AWS_STORAGE_BUCKET_NAME')
        AWS_DEFAULT_ACL = 'private'
        # django-private-storage needs its own S3 configuration
        PRIVATE_STORAGE_CLASS = \
            'private_storage.storage.s3boto3.PrivateS3BotoStorage'
            # NB.........There's intentionally no 3 here! ^
        AWS_PRIVATE_STORAGE_BUCKET_NAME = AWS_STORAGE_BUCKET_NAME
        # Proxy S3 through our application instead of redirecting to bucket
        # URLs with query parameter authentication
        PRIVATE_STORAGE_S3_REVERSE_PROXY = True


''' Django error logging configuration '''
# Need a default logger when sentry is not activated
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


''' Sentry (error log collection service) configuration '''
if os.environ.get('RAVEN_DSN', False):
    import raven
    INSTALLED_APPS = INSTALLED_APPS + (
        'raven.contrib.django.raven_compat',
    )
    RAVEN_CONFIG = {
        'dsn': os.environ['RAVEN_DSN'],
    }

    # Set the `server_name` attribute. See https://docs.sentry.io/hosted/clients/python/advanced/
    server_name = os.environ.get('RAVEN_SERVER_NAME')
    server_name = server_name or '.'.join(filter(None, (
        os.environ.get('KOBOFORM_PUBLIC_SUBDOMAIN', None),
        os.environ.get('PUBLIC_DOMAIN_NAME', None)
    )))
    if server_name:
        RAVEN_CONFIG.update({'name': server_name})

    try:
        RAVEN_CONFIG['release'] = raven.fetch_git_sha(BASE_DIR)
    except raven.exceptions.InvalidGitRepository:
        pass
    # The below is NOT required for Sentry to log unhandled exceptions, but it
    # is necessary for capturing messages sent via the `logging` module.
    # https://docs.getsentry.com/hosted/clients/python/integrations/django/#integration-with-logging
    LOGGING = {
        'version': 1,
        'disable_existing_loggers': False, # Was `True` in Sentry documentation
        'root': {
            'level': 'WARNING',
            'handlers': ['sentry'],
        },
        'formatters': {
            'verbose': {
                'format': '%(levelname)s %(asctime)s %(module)s '
                          '%(process)d %(thread)d %(message)s'
            },
        },
        'handlers': {
            'sentry': {
                'level': 'WARNING',
                'class': 'raven.contrib.django.raven_compat.handlers.SentryHandler',
            },
            'console': {
                'level': 'DEBUG',
                'class': 'logging.StreamHandler',
                'formatter': 'verbose'
            }
        },
        'loggers': {
            'django.db.backends': {
                'level': 'ERROR',
                'handlers': ['console'],
                'propagate': False,
            },
            'raven': {
                'level': 'DEBUG',
                'handlers': ['console'],
                'propagate': False,
            },
            'sentry.errors': {
                'level': 'DEBUG',
                'handlers': ['console'],
                'propagate': False,
            },
            'console_logger': {
                'level': 'DEBUG',
                'handlers': ['console'],
                'propagate': True
            },
        },
    }


''' Try to identify the running codebase for informational purposes '''
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


'''
Since this project handles user creation, we must handle the model-level
permission assignment that would've been done by KoBoCAT's user post_save
signal handler. Here we record the content types of the models listed in KC's
set_api_permissions_for_user(). Verify that this list still matches that
function if you experience permission-related problems. See
https://github.com/kobotoolbox/kobocat/blob/master/onadata/libs/utils/user_auth.py.
'''
KOBOCAT_DEFAULT_PERMISSION_CONTENT_TYPES = [
    # Each tuple must be (app_label, model_name)
    ('main', 'userprofile'),
    ('logger', 'xform'),
    ('logger', 'note'),
]

# A flag set by unit tests to bypass KoBoCAT user syncing
TESTING = False


''' Auxiliary database configuration '''
# KPI must connect to the same Mongo database as KoBoCAT
MONGO_DATABASE = {
    'HOST': os.environ.get('KPI_MONGO_HOST', 'mongo'),
    'PORT': int(os.environ.get('KPI_MONGO_PORT', 27017)),
    'NAME': os.environ.get('KPI_MONGO_NAME', 'formhub'),
    'USER': os.environ.get('KPI_MONGO_USER', ''),
    'PASSWORD': os.environ.get('KPI_MONGO_PASS', '')
}
if MONGO_DATABASE.get('USER') and MONGO_DATABASE.get('PASSWORD'):
    MONGO_CONNECTION_URL = "mongodb://{user}:{password}@{host}:{port}/{db_name}".\
        format(
            user=MONGO_DATABASE['USER'],
            password=quote_plus(MONGO_DATABASE['PASSWORD']),
            host=MONGO_DATABASE['HOST'],
            port=MONGO_DATABASE['PORT'],
            db_name=MONGO_DATABASE['NAME']
        )
else:
    MONGO_CONNECTION_URL = "mongodb://%(HOST)s:%(PORT)s/%(NAME)s" % MONGO_DATABASE
MONGO_CONNECTION = MongoClient(
    MONGO_CONNECTION_URL, j=True, tz_aware=True, connect=False)
MONGO_DB = MONGO_CONNECTION[MONGO_DATABASE['NAME']]

MONGO_DB_MAX_TIME_MS = CELERY_TASK_TIME_LIMIT * 1000

SESSION_ENGINE = "redis_sessions.session"
SESSION_REDIS = RedisHelper.config(default="redis://redis_cache:6380/2")

ENV = None

# The maximum size in bytes that a request body may be before a
# SuspiciousOperation (RequestDataTooBig) is raised
DATA_UPLOAD_MAX_MEMORY_SIZE = 10485760

# The maximum size (in bytes) that an upload will be before it gets streamed
# to the file system
FILE_UPLOAD_MAX_MEMORY_SIZE = 10485760

# OpenRosa setting in bytes
OPEN_ROSA_DEFAULT_CONTENT_LENGTH = 10000000

# Expiration time in sec. after which paired data xml file must be regenerated
# Should match KoBoCAT setting
PAIRED_DATA_EXPIRATION = 300

# Minimum size (in bytes) of files to allow fast calculation of hashes
# Should match KoBoCAT setting
HASH_BIG_FILE_SIZE_THRESHOLD = 0.5 * 1024 * 1024  # 512 kB

# Chunk size in bytes to read per iteration when hash of a file is calculated
# Should match KoBoCAT setting
HASH_BIG_FILE_CHUNK = 16 * 1024  # 16 kB

# add some mimetype
add_type('application/wkt', '.wkt')
add_type('application/geo+json', '.geojson')
