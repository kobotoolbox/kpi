"""
Django settings for kobo_playground project.

For more information on this file, see
https://docs.djangoproject.com/en/1.7/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/1.7/ref/settings/
"""

from django.conf import global_settings

# Build paths inside the project like this: os.path.join(BASE_DIR, ...)
import os
import dj_database_url

BASE_DIR = os.path.dirname(os.path.dirname(__file__))


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/1.7/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
# Secret key must match that used by KoBoCAT when sharing sessions
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', '@25)**hc^rjaiagb4#&q*84hr*uscsxwr-cv#0joiwj$))obyk')

# Domain must not exclude KoBoCAT when sharing sessions
if 'CSRF_COOKIE_DOMAIN' in os.environ:
    CSRF_COOKIE_DOMAIN = os.environ['CSRF_COOKIE_DOMAIN']
    SESSION_COOKIE_DOMAIN = CSRF_COOKIE_DOMAIN
    SESSION_COOKIE_NAME = 'kobonaut'

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = (os.environ.get('DJANGO_DEBUG', 'True') == 'True')

TEMPLATE_DEBUG = (os.environ.get('TEMPLATE_DEBUG', 'True') == 'True')

ALLOWED_HOSTS = []
if 'DJANGO_ALLOWED_HOSTS' in os.environ:
    ALLOWED_HOSTS.append(os.environ['DJANGO_ALLOWED_HOSTS'])

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
    'cachebuster',
    'django.contrib.staticfiles',
    'reversion',
    'debug_toolbar',
    'mptt',
    'haystack',
    'kpi',
    'hub',
    'registration', # Must come AFTER kpi
    'django.contrib.admin', # Must come AFTER registration
    'django_extensions',
    'taggit',
    'rest_framework',
    'rest_framework.authtoken',
)

MIDDLEWARE_CLASSES = (
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.auth.middleware.SessionAuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'kpi.middleware.OtherFormBuilderRedirectMiddleware',
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

ROOT_URLCONF = 'kobo_playground.urls'

WSGI_APPLICATION = 'kobo_playground.wsgi.application'

# What User object should be mapped to AnonymousUser?
ANONYMOUS_USER_ID = -1
# Permissions assigned to AnonymousUser are restricted to the following
ALLOWED_ANONYMOUS_PERMISSIONS = (
    'kpi.view_collection',
    'kpi.view_asset',
)


# Database
# https://docs.djangoproject.com/en/1.7/ref/settings/#databases

DATABASES = {
    'default': dj_database_url.config(default="sqlite:///%s/db.sqlite3" % BASE_DIR),
}

# Internationalization
# https://docs.djangoproject.com/en/1.7/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_L10N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/1.7/howto/static-files/

STATIC_ROOT = 'staticfiles'
STATIC_URL = '/static/'

# KPI_URL should be set in the environment when running in a subdirectory
KPI_URL = os.environ.get('KPI_URL', False)
if KPI_URL:
    STATIC_URL = KPI_URL + STATIC_URL

STATICFILES_DIRS = (
    os.path.join(BASE_DIR, 'jsapp'),
    os.path.join(BASE_DIR, 'static'),
)

from cachebuster.detectors import git
CACHEBUSTER_UNIQUE_STRING = git.unique_string(__file__)[:6]

if os.path.exists(os.path.join(BASE_DIR, 'dkobo', 'jsapp')):
    STATICFILES_DIRS = STATICFILES_DIRS + (
        os.path.join(BASE_DIR, 'dkobo', 'jsapp'),
        os.path.join(BASE_DIR, 'dkobo', 'dkobo', 'static'),
    )

REST_FRAMEWORK = {
    'URL_FIELD_NAME': 'url',
    'DEFAULT_PAGINATION_CLASS': 'kpi.serializers.Paginated',
    'PAGE_SIZE': 100,
}

TEMPLATE_CONTEXT_PROCESSORS = global_settings.TEMPLATE_CONTEXT_PROCESSORS + (
    'kpi.context_processors.dev_mode',
)

# This is very brittle (can't handle references to missing images in CSS);
# TODO: replace later with grunt gzipping?
#if not DEBUG:
#    STATICFILES_STORAGE = 'whitenoise.django.GzipManifestStaticFilesStorage'

LIVERELOAD_SCRIPT = os.environ.get('LIVERELOAD_SCRIPT', False)
USE_MINIFIED_SCRIPTS = os.environ.get('KOBO_USE_MINIFIED_SCRIPTS', False)
TRACKJS_TOKEN = os.environ.get('TRACKJS_TOKEN')
KOBOCAT_URL = os.environ.get('KOBOCAT_URL', False)
KOBOCAT_INTERNAL_URL = os.environ.get('KOBOCAT_INTERNAL_URL', False)
DKOBO_URL = os.environ.get('DKOBO_URL', False)

''' Haystack search settings '''
HAYSTACK_CONNECTIONS = {
    'default': {
        'ENGINE': 'haystack.backends.whoosh_backend.WhooshEngine',
        'PATH': os.path.join(os.path.dirname(__file__), 'whoosh_index'),
    },
}
# If this causes performance trouble, see
# http://django-haystack.readthedocs.org/en/latest/best_practices.html#use-of-a-queue-for-a-better-user-experience
HAYSTACK_SIGNAL_PROCESSOR = 'haystack.signals.RealtimeSignalProcessor'

''' Enketo settings copied from dkobo '''
ENKETO_SERVER = os.environ.get('ENKETO_SERVER', 'https://enketo.org')
ENKETO_PREVIEW_URI = os.environ.get('ENKETO_PREVIEW_URI', '/webform/preview')
# The number of hours to keep a kobo survey preview (generated for enketo)
# around before purging it.
KOBO_SURVEY_PREVIEW_EXPIRATION = os.environ.get('KOBO_SURVEY_PREVIEW_EXPIRATION', 24)

''' Celery configuration '''
# Uncomment to enable failsafe search indexing
#from datetime import timedelta
#CELERYBEAT_SCHEDULE = {
#    # Update the Haystack index twice per day to catch any stragglers that
#    # might have gotten past haystack.signals.RealtimeSignalProcessor
#    'update-search-index': {
#        'task': 'kpi.tasks.update_search_index',
#        'schedule': timedelta(hours=12)
#    },
#}
'''
Distinct projects using Celery need their own queues. Example commands for
RabbitMQ queue creation:
    rabbitmqctl add_user kpi kpi
    rabbitmqctl add_vhost kpi
    rabbitmqctl set_permissions -p kpi kpi '.*' '.*' '.*'
See http://celery.readthedocs.org/en/latest/getting-started/brokers/rabbitmq.html#setting-up-rabbitmq.
'''
BROKER_URL = 'amqp://kpi:kpi@localhost:5672/kpi'

# http://django-registration-redux.readthedocs.org/en/latest/quickstart.html#settings
ACCOUNT_ACTIVATION_DAYS = 3
REGISTRATION_AUTO_LOGIN = True
REGISTRATION_EMAIL_HTML = False # Otherwise we have to write HTML templates

# Email configuration from dkobo; expects SES
if os.environ.get('EMAIL_BACKEND'):
    EMAIL_BACKEND = os.environ.get('EMAIL_BACKEND')

if os.environ.get('DEFAULT_FROM_EMAIL'):
    DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL')
    SERVER_EMAIL = DEFAULT_FROM_EMAIL

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
    try:
        RAVEN_CONFIG['release'] = raven.fetch_git_sha(BASE_DIR)
    except raven.exceptions.InvalidGitRepository:
        pass

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
