"""
Django settings for kobo project.

For more information on this file, see
https://docs.djangoproject.com/en/1.7/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/1.7/ref/settings/
"""

from datetime import timedelta
import multiprocessing
import os
import subprocess

from django.conf import global_settings
from django.conf.global_settings import LOGIN_URL
from django.utils.translation import get_language_info
import dj_database_url

from pymongo import MongoClient

from static_lists import NATIVE_LANGUAGE_NAMES


# Build paths inside the project like this: os.path.join(BASE_DIR, ...)
BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/1.7/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
# Secret key must match that used by KoBoCAT when sharing sessions
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', '@25)**hc^rjaiagb4#&q*84hr*uscsxwr-cv#0joiwj$))obyk')

# Optionally treat proxied connections as secure.
# See: https://docs.djangoproject.com/en/1.8/ref/settings/#secure-proxy-ssl-header.
# Example environment: `export SECURE_PROXY_SSL_HEADER='HTTP_X_FORWARDED_PROTO, https'`.
# SECURITY WARNING: If enabled, outer web server must filter out the `X-Forwarded-Proto` header.
if 'SECURE_PROXY_SSL_HEADER' in os.environ:
    SECURE_PROXY_SSL_HEADER = tuple((substring.strip() for substring in
                                     os.environ['SECURE_PROXY_SSL_HEADER'].split(',')))

UPCOMING_DOWNTIME = False

# Domain must not exclude KoBoCAT when sharing sessions
if os.environ.get('CSRF_COOKIE_DOMAIN'):
    CSRF_COOKIE_DOMAIN = os.environ['CSRF_COOKIE_DOMAIN']
    SESSION_COOKIE_DOMAIN = CSRF_COOKIE_DOMAIN
    SESSION_COOKIE_NAME = 'kobonaut'

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = (os.environ.get('DJANGO_DEBUG', 'True') == 'True')

TEMPLATE_DEBUG = (os.environ.get('TEMPLATE_DEBUG', 'True') == 'True')

ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', '*').split(' ')

LOGIN_REDIRECT_URL = '/'

# Application definition

# The order of INSTALLED_APPS is important for template resolution. When two
# apps both define templates for the same view, the first app listed receives
# precedence
INSTALLED_APPS = (
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'reversion',
    'debug_toolbar',
    'mptt',
    'haystack',
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
    'guardian', # For access to KC permissions ONLY
)

MIDDLEWARE_CLASSES = (
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.locale.LocaleMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    # TODO: Uncomment this when interoperability with dkobo is no longer
    # needed. See https://code.djangoproject.com/ticket/21649
    #'django.contrib.auth.middleware.SessionAuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'hub.middleware.OtherFormBuilderRedirectMiddleware',
)

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
    'kpi.view_collection',
    'kpi.view_asset',
)

# run heavy migration scripts by default
# NOTE: this should be set to False for major deployments. This can take a long time
SKIP_HEAVY_MIGRATIONS = os.environ.get('SKIP_HEAVY_MIGRATIONS', 'False') == 'True'

# Database
# https://docs.djangoproject.com/en/1.7/ref/settings/#databases
DATABASES = {
    'default': dj_database_url.config(default="sqlite:///%s/db.sqlite3" % BASE_DIR),
}
# This project does not use GIS (yet). Change the database engine accordingly
# to avoid unnecessary dependencies.
for db in DATABASES.values():
    if db['ENGINE'] == 'django.contrib.gis.db.backends.postgis':
        db['ENGINE'] = 'django.db.backends.postgresql_psycopg2'


# Internationalization
# https://docs.djangoproject.com/en/1.8/topics/i18n/

def get_native_language_name(lang_code):
    try:
        return get_language_info(lang_code)['name_local']
    except KeyError:
        pass
    try:
        return NATIVE_LANGUAGE_NAMES[lang_code]
    except KeyError:
        raise KeyError(u'Please add an entry for {} to '
                       u'kobo.static_lists.NATIVE_LANGUAGE_NAMES and try '
                       u'again.'.format(lang_code))

LANGUAGES = [
    (lang_code, get_native_language_name(lang_code))
        for lang_code in os.environ.get(
            'DJANGO_LANGUAGE_CODES', 'en').split(' ')
]

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

LOCALE_PATHS= (os.path.join(BASE_DIR, 'locale'),)

USE_I18N = True

USE_L10N = True

USE_TZ = True

CAN_LOGIN_AS = lambda request, target_user: request.user.is_superuser


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/1.7/howto/static-files/

STATIC_ROOT = 'staticfiles'
STATIC_URL = '/static/'

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
    LOGIN_URL = KPI_PREFIX + '/' + LOGIN_URL.lstrip('/')
    LOGIN_REDIRECT_URL = KPI_PREFIX + '/' + LOGIN_REDIRECT_URL.lstrip('/')

STATICFILES_DIRS = (
    os.path.join(BASE_DIR, 'jsapp'),
    os.path.join(BASE_DIR, 'static'),
    ('mocha', os.path.join(BASE_DIR, 'node_modules', 'mocha'),),
)

if os.path.exists(os.path.join(BASE_DIR, 'dkobo', 'jsapp')):
    STATICFILES_DIRS = STATICFILES_DIRS + (
        os.path.join(BASE_DIR, 'dkobo', 'jsapp'),
        os.path.join(BASE_DIR, 'dkobo', 'dkobo', 'static'),
    )

REST_FRAMEWORK = {
    'URL_FIELD_NAME': 'url',
    'DEFAULT_PAGINATION_CLASS': 'kpi.serializers.Paginated',
    'PAGE_SIZE': 100,
    'DEFAULT_AUTHENTICATION_CLASSES': [
        # SessionAuthentication and BasicAuthentication would be included by
        # default
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.BasicAuthentication',
        'rest_framework.authentication.TokenAuthentication',
    ],
}

TEMPLATE_CONTEXT_PROCESSORS = global_settings.TEMPLATE_CONTEXT_PROCESSORS + (
    'kpi.context_processors.external_service_tokens',
    'kpi.context_processors.email',
    'kpi.context_processors.sitewide_messages',
)

# This is very brittle (can't handle references to missing images in CSS);
# TODO: replace later with grunt gzipping?
#if not DEBUG:
#    STATICFILES_STORAGE = 'whitenoise.django.GzipManifestStaticFilesStorage'

TRACKJS_TOKEN = os.environ.get('TRACKJS_TOKEN')
GOOGLE_ANALYTICS_TOKEN = os.environ.get('GOOGLE_ANALYTICS_TOKEN')
INTERCOM_APP_ID = os.environ.get('INTERCOM_APP_ID')

# replace this with the pointer to the kobocat server, if it exists
KOBOCAT_URL = os.environ.get('KOBOCAT_URL', 'http://kobocat/')
KOBOCAT_INTERNAL_URL = os.environ.get('KOBOCAT_INTERNAL_URL',
                                      'http://kobocat/')
if 'KOBOCAT_URL' in os.environ:
    DEFAULT_DEPLOYMENT_BACKEND = 'kobocat'
else:
    DEFAULT_DEPLOYMENT_BACKEND = 'mock'

# Following the uWSGI mountpoint convention, this should have a leading slash
# but no trailing slash
DKOBO_PREFIX = os.environ.get('DKOBO_PREFIX', 'False')
if DKOBO_PREFIX.lower() == 'false':
    DKOBO_PREFIX = False
else:
    DKOBO_PREFIX = '/' + DKOBO_PREFIX.strip('/')

''' Haystack search settings '''
WHOOSH_PATH = os.path.join(
    os.environ.get('KPI_WHOOSH_DIR', os.path.dirname(__file__)),
    'whoosh_index'
)
HAYSTACK_CONNECTIONS = {
    'default': {
        'ENGINE': 'haystack.backends.whoosh_backend.WhooshEngine',
        'PATH': WHOOSH_PATH,
    },
}
# Listed models will be indexed in real time. TaggedItem is handled differently
# and hard-coded into kpi.haystack_utils.SignalProcessor, so do not list it
# here.
HAYSTACK_SIGNAL_MODELS = (
    # Each tuple must be (app_label, model_name)
    ('kpi', 'Asset'),
    ('kpi', 'Collection'),
    ('taggit', 'Tag'),
)
# If this causes performance trouble, see
# http://django-haystack.readthedocs.org/en/latest/best_practices.html#use-of-a-queue-for-a-better-user-experience
HAYSTACK_SIGNAL_PROCESSOR = 'kpi.haystack_utils.SignalProcessor'

# Enketo settings copied from dkobo.
ENKETO_SERVER = os.environ.get('ENKETO_URL') or os.environ.get('ENKETO_SERVER', 'https://enketo.org')
ENKETO_SERVER= ENKETO_SERVER + '/' if not ENKETO_SERVER.endswith('/') else ENKETO_SERVER
ENKETO_VERSION= os.environ.get('ENKETO_VERSION', 'Legacy').lower()
assert ENKETO_VERSION in ['legacy', 'express']
ENKETO_PREVIEW_URI = 'webform/preview' if ENKETO_VERSION == 'legacy' else 'preview'
# The number of hours to keep a kobo survey preview (generated for enketo)
# around before purging it.
KOBO_SURVEY_PREVIEW_EXPIRATION = os.environ.get('KOBO_SURVEY_PREVIEW_EXPIRATION', 24)

ENKETO_API_TOKEN = os.environ.get('ENKETO_API_TOKEN', 'enketorules')
# http://apidocs.enketo.org/v2/
ENKETO_SURVEY_ENDPOINT = 'api/v2/survey/all'

''' Celery configuration '''

if os.environ.get('SKIP_CELERY', 'False') == 'True':
    # helpful for certain debugging
    CELERY_ALWAYS_EAGER = True

# Celery defaults to having as many workers as there are cores. To avoid
# excessive resource consumption, don't spawn more than 6 workers by default
# even if there more than 6 cores.
CELERYD_MAX_CONCURRENCY = int(os.environ.get('CELERYD_MAX_CONCURRENCY', 6))
if multiprocessing.cpu_count() > CELERYD_MAX_CONCURRENCY:
    CELERYD_CONCURRENCY = CELERYD_MAX_CONCURRENCY

# Replace a worker after it completes 7 tasks by default. This allows the OS to
# reclaim memory allocated during large tasks
CELERYD_MAX_TASKS_PER_CHILD = int(os.environ.get(
    'CELERYD_MAX_TASKS_PER_CHILD', 7))

# Default to a 30-minute soft time limit and a 35-minute hard time limit
CELERYD_TASK_TIME_LIMIT = int(os.environ.get('CELERYD_TASK_TIME_LIMIT', 2100))
CELERYD_TASK_SOFT_TIME_LIMIT = int(os.environ.get(
    'CELERYD_TASK_SOFT_TIME_LIMIT', 1800))

CELERYBEAT_SCHEDULE = {
    # Failsafe search indexing: update the Haystack index twice per day to
    # catch any stragglers that might have gotten past
    # haystack.signals.RealtimeSignalProcessor
    #'update-search-index': {
    #    'task': 'kpi.tasks.update_search_index',
    #    'schedule': timedelta(hours=12)
    #},
}

if 'KOBOCAT_URL' in os.environ:
    SYNC_KOBOCAT_XFORMS = (os.environ.get('SYNC_KOBOCAT_XFORMS', 'True') == 'True')
    SYNC_KOBOCAT_PERMISSIONS = (
        os.environ.get('SYNC_KOBOCAT_PERMISSIONS', 'True') == 'True')
    if SYNC_KOBOCAT_XFORMS:
        # Create/update KPI assets to match KC forms
        SYNC_KOBOCAT_XFORMS_PERIOD_MINUTES = int(
            os.environ.get('SYNC_KOBOCAT_XFORMS_PERIOD_MINUTES', '30'))
        CELERYBEAT_SCHEDULE['sync-kobocat-xforms'] = {
            'task': 'kpi.tasks.sync_kobocat_xforms',
            'schedule': timedelta(minutes=SYNC_KOBOCAT_XFORMS_PERIOD_MINUTES),
            'options': {'queue': 'sync_kobocat_xforms_queue',
                        'expires': SYNC_KOBOCAT_XFORMS_PERIOD_MINUTES /2. * 60},
        }

'''
Distinct projects using Celery need their own queues. Example commands for
RabbitMQ queue creation:
    rabbitmqctl add_user kpi kpi
    rabbitmqctl add_vhost kpi
    rabbitmqctl set_permissions -p kpi kpi '.*' '.*' '.*'
See http://celery.readthedocs.org/en/latest/getting-started/brokers/rabbitmq.html#setting-up-rabbitmq.
'''
BROKER_URL = os.environ.get('KPI_BROKER_URL', 'amqp://kpi:kpi@rabbit:5672/kpi')

# http://django-registration-redux.readthedocs.org/en/latest/quickstart.html#settings
ACCOUNT_ACTIVATION_DAYS = 3
REGISTRATION_AUTO_LOGIN = True
REGISTRATION_EMAIL_HTML = False # Otherwise we have to write HTML templates

WEBPACK_LOADER = {
    'DEFAULT': {
        'BUNDLE_DIR_NAME': 'jsapp/compiled/',
        'POLL_INTERVAL': 0.5,
        'TIMEOUT': 5,
    }
}

# Email configuration from dkobo; expects SES
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

if os.environ.get('DEFAULT_FROM_EMAIL'):
    DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL')
    SERVER_EMAIL = DEFAULT_FROM_EMAIL

KOBO_SUPPORT_URL = os.environ.get('KOBO_SUPPORT_URL', 'http://support.kobotoolbox.org/')
KOBO_SUPPORT_EMAIL = os.environ.get('KOBO_SUPPORT_EMAIL') or os.environ.get('DEFAULT_FROM_EMAIL', 'support@kobotoolbox.org')

if os.environ.get('AWS_ACCESS_KEY_ID'):
    AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
    AWS_SES_REGION_NAME = os.environ.get('AWS_SES_REGION_NAME')
    AWS_SES_REGION_ENDPOINT = os.environ.get('AWS_SES_REGION_ENDPOINT')

''' Sentry configuration '''
if 'RAVEN_DSN' in os.environ:
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
        },
    }


''' Try to identify the running codebase. Based upon
https://github.com/tblobaum/git-rev/blob/master/index.js '''
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
# Only superusers will be able to see this information unless
# EXPOSE_GIT_REV=TRUE is set in the environment
EXPOSE_GIT_REV = os.environ.get('EXPOSE_GIT_REV', '').upper() == 'TRUE'


''' Since this project handles user creation but shares its database with
KoBoCAT, we must handle the model-level permission assignment that would've
been done by KoBoCAT's post_save signal handler. Here we record the content
types of the models listed in KC's set_api_permissions_for_user(). Verify that
this list still matches that function if you experience permission-related
problems. See
https://github.com/kobotoolbox/kobocat/blob/master/onadata/libs/utils/user_auth.py.
'''
KOBOCAT_DEFAULT_PERMISSION_CONTENT_TYPES = [
    # Each tuple must be (app_label, model_name)
    ('main', 'userprofile'),
    ('logger', 'xform'),
    ('api', 'project'),
    ('api', 'team'),
    ('api', 'organizationprofile'),
    ('logger', 'note'),
]

MONGO_DATABASE = {
    'HOST': os.environ.get('KPI_MONGO_HOST', 'mongo'),
    'PORT': int(os.environ.get('KPI_MONGO_PORT', 27017)),
    'NAME': os.environ.get('KPI_MONGO_NAME', 'formhub'),
    'USER': os.environ.get('KPI_MONGO_USER', ''),
    'PASSWORD': os.environ.get('KPI_MONGO_PASS', '')
}

if MONGO_DATABASE.get('USER') and MONGO_DATABASE.get('PASSWORD'):
    MONGO_CONNECTION_URL = (
        "mongodb://%(USER)s:%(PASSWORD)s@%(HOST)s:%(PORT)s") % MONGO_DATABASE
else:
    MONGO_CONNECTION_URL = "mongodb://%(HOST)s:%(PORT)s" % MONGO_DATABASE

MONGO_CONNECTION = MongoClient(
    MONGO_CONNECTION_URL, j=True, tz_aware=True)
MONGO_DB = MONGO_CONNECTION[MONGO_DATABASE['NAME']]
