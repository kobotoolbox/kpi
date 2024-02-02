import os
import sys
from datetime import timedelta

import environ
from celery.schedules import crontab
from django.core.exceptions import SuspiciousOperation

env = environ.Env()


def skip_suspicious_operations(record):
    """Prevent django from sending 500 error
    email notifications for SuspiciousOperation
    events, since they are not true server errors,
    especially when related to the ALLOWED_HOSTS
    configuration

    background and more information:
    http://www.tiwoc.de/blog/2013/03/django-prevent-email-notification-on-suspiciousoperation/
    """
    if record.exc_info:
        exc_value = record.exc_info[1]
        if isinstance(exc_value, SuspiciousOperation):
            return False
    return True

# FIXME Kobocat migration: Still valid ?
# BASE_DIR = os.path.dirname(os.path.dirname(__file__))
# kobo.apps.open_rosa_server_DIR = BASE_DIR
# PROJECT_ROOT = os.path.abspath(os.path.join(kobo.apps.open_rosa_server_DIR, '..'))

################################
# Django Framework settings    #
################################

# # Django `SECRET_KEY`
# SECRET_KEY = env('DJANGO_SECRET_KEY')
#
# TEMPLATED_EMAIL_TEMPLATE_DIR = 'templated_email/'
#
# ADMINS = (
#     # ('Your Name', 'your_email@example.com'),
# )
# MANAGERS = ADMINS


# DEFAULT_FROM_EMAIL = 'noreply@kobotoolbox.org'
#
# DEFAULT_SESSION_EXPIRY_TIME = 21600  # 6 hours

# # Local time zone for this installation. Choices can be found here:
# # http://en.wikipedia.org/wiki/List_of_tz_zones_by_name
# # although not all choices may be available on all operating systems.
# # On Unix systems, a value of None will cause Django to use the same
# # timezone as the operating system.
# # If running in a Windows environment this must be set to the same as your
# # system time zone.
# TIME_ZONE = 'UTC'
# USE_TZ = True

# Language code for this installation. All choices can be found here:
# http://www.i18nguy.com/unicode/language-identifiers.html
# LANGUAGE_CODE = 'en-us'

# # If you set this to False, Django will make some optimizations so as not
# # to load the internationalization machinery.
# USE_I18N = True
#
# # If you set this to False, Django will not format dates, numbers and
# # calendars according to the current locale
# USE_L10N = True

# URL that handles the media served from MEDIA_ROOT. Make sure to use a
# trailing slash.
# Examples: "http://media.lawrence.com/media/", "http://example.com/media/"
MEDIA_URL = f"/{env.str('KOBOCAT_MEDIA_URL', 'media').strip('/')}/"


# FIXME Kobocat migration: Validate path with Nginx
# # Absolute path to the directory static files should be collected to.
# # Don't put anything in this directory yourself; store your static files
# # in apps' "static/" subdirectories and in STATICFILES_DIRS.
# # Example: "/home/media/media.lawrence.com/static/"
# STATIC_ROOT = os.path.join(kobo.apps.open_rosa_server_DIR, 'static')

# URL prefix for static files.
# Example: "http://media.lawrence.com/static/"
# STATIC_URL = '/static/'

# FIXME Kobocat migration: Let's stop support it!
# if os.environ.get('KOBOCAT_ROOT_URI_PREFIX'):
#     KOBOCAT_ROOT_URI_PREFIX = '/' + os.environ['KOBOCAT_ROOT_URI_PREFIX'].strip('/') + '/'
#     MEDIA_URL = KOBOCAT_ROOT_URI_PREFIX + MEDIA_URL.lstrip('/')
#     STATIC_URL = KOBOCAT_ROOT_URI_PREFIX + STATIC_URL.lstrip('/')
#
# FIXME Kobocat migration: Conflict with KPI?
# MEDIA_ROOT = os.path.join(PROJECT_ROOT, MEDIA_URL.lstrip('/'))

# FIXME Kobocat migration: Deprecated
# # URL prefix for admin static files -- CSS, JavaScript and images.
# # Make sure to use a trailing slash.
# # Examples: "http://foo.com/static/admin/", "/static/admin/".
# ADMIN_MEDIA_PREFIX = '/static/admin/'

# FIXME Kobocat migration: Deprecated - Used in main base.py
# # List of finder classes that know how to find static files in
# # various locations.
# STATICFILES_FINDERS = [
#     'django.contrib.staticfiles.finders.FileSystemFinder',
#     'django.contrib.staticfiles.finders.AppDirectoriesFinder',
# ]


# FIXME Kobocat migration: Merged
# MIDDLEWARE = [
#     # 'kobo.apps.openrosa.koboform.redirect_middleware.ConditionalRedirects',
#     'kobo.apps.openrosa.apps.main.middleware.RevisionMiddleware',
#     # 'django.middleware.security.SecurityMiddleware',
#     # 'django.contrib.sessions.middleware.SessionMiddleware',
#     # 'django.middleware.locale.LocaleMiddleware',
#     # 'django.middleware.common.CommonMiddleware',
#     'kobo.apps.openrosa.libs.utils.middleware.LocaleMiddlewareWithTweaks',
#     # 'django.middleware.csrf.CsrfViewMiddleware',
#     'corsheaders.middleware.CorsMiddleware',
#     # 'django.contrib.auth.middleware.AuthenticationMiddleware',
#     'kobo.apps.openrosa.libs.utils.middleware.RestrictedAccessMiddleware',
#     # 'django.contrib.messages.middleware.MessageMiddleware',
#     'kobo.apps.openrosa.libs.utils.middleware.HTTPResponseNotAllowedMiddleware',
#     # 'readonly.middleware.DatabaseReadOnlyMiddleware',
#     # 'kobo.apps.openrosa.libs.utils.middleware.UsernameInResponseHeaderMiddleware',
# ]


# FIXME Kobocat migration: Deprecated - Used main base.py value
# ROOT_URLCONF = 'kobo.apps.openrosa.apps.main.urls'

# FIXME Kobocat migration: Deprecated - Used main base.py value
# # specify the root folder which may contain a templates folder and a static
# # folder used to override templates for site specific details
# # include the kobocat-template directory
# TEMPLATE_OVERRIDE_ROOT_DIR = env.str(
#     'KOBOCAT_TEMPLATES_PATH',
#     os.path.abspath(os.path.join(PROJECT_ROOT, 'kobocat-template'))
# )
#
# TEMPLATES = [
#     {
#         'BACKEND': 'django.template.backends.django.DjangoTemplates',
#         'APP_DIRS': False,
#         'DIRS': [
#             os.path.join(TEMPLATE_OVERRIDE_ROOT_DIR, 'templates'),
#             os.path.join(kobo.apps.open_rosa_server_DIR, 'libs/templates')
#         ],
#         'OPTIONS': {
#             'context_processors': [
#                 'django.contrib.auth.context_processors.auth',
#                 'django.template.context_processors.debug',
#                 'django.template.context_processors.i18n',
#                 'django.template.context_processors.media',
#                 'django.template.context_processors.static',
#                 'django.template.context_processors.tz',
#                 'django.template.context_processors.request',
#                 'django.contrib.messages.context_processors.messages',
#                 'readonly.context_processors.readonly',
#                 # Additional processors
#                 'kobo.apps.openrosa.koboform.context_processors.koboform_integration',
#                 'kobo.apps.openrosa.apps.main.context_processors.google_analytics',
#                 'kobo.apps.openrosa.apps.main.context_processors.site_name',
#                 'kobo.apps.openrosa.apps.main.context_processors.base_url'
#             ],
#             'loaders': [
#                 'django.template.loaders.filesystem.Loader',
#                 'django.template.loaders.app_directories.Loader',
#             ],
#             'debug': env.bool('TEMPLATE_DEBUG', False),
#         },
#     }
# ]

# DIRS = [
#     os.path.join(TEMPLATE_OVERRIDE_ROOT_DIR, 'templates'),
#     os.path.join(kobo.apps.open_rosa_server_DIR, 'libs/templates'),
# ]
#
# # Additional locations of static files
# STATICFILES_DIRS = [
#     # Put strings here, like "/home/html/static" or "C:/www/django/static".
#     # Always use forward slashes, even on Windows.
#     # Don't forget to use absolute paths, not relative paths.
#     os.path.join(TEMPLATE_OVERRIDE_ROOT_DIR, 'static')
# ]

# FIXME Kobocat migration: Merged
# INSTALLED_APPS = [
#     # 'django.contrib.contenttypes',
#     # # Always put `contenttypes` before `auth`; see
#     # # https://code.djangoproject.com/ticket/10827
#     # 'django.contrib.auth',
#     # 'django.contrib.sessions',
#     # 'django.contrib.sites',
#     # 'django.contrib.messages',
#     # 'django.contrib.staticfiles',
#     # 'django.contrib.humanize',
#     # 'django.contrib.admin',
#     # 'django.contrib.admindocs',
#     # 'django.contrib.gis',
#     # 'reversion',
#     # 'django_digest',
#     # 'corsheaders',
#     # 'oauth2_provider',
#     'kobo.apps.openrosa.apps.logger.LoggerAppConfig',
#     # 'rest_framework',
#     # 'rest_framework.authtoken',
#     # 'taggit',
#     # 'readonly',
#     'kobo.apps.openrosa.apps.viewer',
#     'kobo.apps.openrosa.apps.main',
#     'kobo.apps.openrosa.apps.restservice',
#     'kobo.apps.openrosa.apps.api',
#     'guardian',
#     'kobo.apps.openrosa.libs',
#     # 'pure_pagination',
#     # 'django_celery_beat',
#     # 'django_extensions',
#     'kobo.apps.openrosa.apps.form_disclaimer.FormDisclaimerAppConfig',
# ]

# FIXME Kobocat migration: Does it break KPI to keep it?
USE_THOUSAND_SEPARATOR = True

# COMPRESS = True

# FIXME Kobocat migration: Duplicate, To be merged
# A sample logging configuration. The only tangible logging
# performed by this configuration is to send an email to
# the site admins on every HTTP 500 error.
# See http://docs.djangoproject.com/en/dev/topics/logging for
# more details on how to customize your logging configuration.
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
    'filters': {
        'require_debug_false': {
            '()': 'django.utils.log.RequireDebugFalse'
        },
        # Define filter for suspicious urls
        'skip_suspicious_operations': {
            '()': 'django.utils.log.CallbackFilter',
            'callback': skip_suspicious_operations,
        },
    },
    'handlers': {
        'mail_admins': {
            'level': 'ERROR',
            'filters': ['require_debug_false', 'skip_suspicious_operations'],
            'class': 'django.utils.log.AdminEmailHandler'
        },
        'console': {
            'level': 'DEBUG',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
            'stream': sys.stdout
        },
        'audit': {
            'level': 'DEBUG',
            'class': 'kobo.apps.openrosa.libs.utils.log.AuditLogHandler',
            'formatter': 'verbose',
            'model': 'kobo.apps.openrosa.apps.main.models.audit.AuditLog'
        }
    },
    'loggers': {
        'django.request': {
            'handlers': ['mail_admins', 'console'],
            'level': 'DEBUG',
            'propagate': True,
        },
        'console_logger': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': True
        },
        'audit_logger': {
            'handlers': ['audit'],
            'level': 'DEBUG',
            'propagate': True
        }
    }
}

# FIXME Kobocat migration: Deprecated, Not used anymore
# extra data stored with users
# AUTH_PROFILE_MODULE = 'kobo.apps.openrosa.apps.main.UserProfile'

# FIXME Kobocat migration: Merged
# AUTHENTICATION_BACKENDS = (
#     'django.contrib.auth.backends.ModelBackend',
#     'guardian.backends.ObjectPermissionBackend',
# )

# FIXME Kobocat migration: Duplicate
# # Make Django use NGINX $host. Useful when running with ./manage.py runserver_plus
# # It avoids adding the debugger webserver port (i.e. `:8000`) at the end of urls.
# if os.getenv("USE_X_FORWARDED_HOST", "False") == "True":
#     USE_X_FORWARDED_HOST = True
#
# # "Although the setting offers little practical benefit, it's sometimes
# # required by security auditors."
# # -- https://docs.djangoproject.com/en/2.2/ref/settings/#csrf-cookie-httponly
# CSRF_COOKIE_HTTPONLY = True
# # SESSION_COOKIE_HTTPONLY is more useful, but it defaults to True.
#
# if env.str('PUBLIC_REQUEST_SCHEME', '').lower() == 'https':
#     SESSION_COOKIE_SECURE = True
#     CSRF_COOKIE_SECURE = True
#
# SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool('SECURE_HSTS_INCLUDE_SUBDOMAINS', False)
# SECURE_HSTS_PRELOAD = env.bool('SECURE_HSTS_PRELOAD', False)
# SECURE_HSTS_SECONDS = env.int('SECURE_HSTS_SECONDS', 0)
#
# # Limit sessions to 1 week (the default is 2 weeks)
# SESSION_COOKIE_AGE = env.int('DJANGO_SESSION_COOKIE_AGE', 604800)

# # The maximum size in bytes that a request body may be before a SuspiciousOperation (RequestDataTooBig) is raised  # noqa
# # This variable is available only in Django 1.10+. Only there for next upgrade
# DATA_UPLOAD_MAX_MEMORY_SIZE = 10485760
#
# # The maximum size (in bytes) that an upload will be before it gets streamed to the file system # noqa
# FILE_UPLOAD_MAX_MEMORY_SIZE = 10485760

# LOCALE_PATHS = [os.path.join(PROJECT_ROOT, 'locale'), ]
#
# DEBUG = env.bool('DJANGO_DEBUG', True)

# FIXME Kobocat migration: Replaced by main base.py
# # Database (i.e. PostgreSQL)
# DATABASES = {
#     'default': env.db_url(
#         'KC_DATABASE_URL' if 'KC_DATABASE_URL' in os.environ else 'DATABASE_URL',
#         default='sqlite:///%s/db.sqlite3' % BASE_DIR
#     ),
# }

# FIXME Kobocat migration: Behaviour change. Should we include `ATOMIC_REQUEST` in Kobocat DATABASE_URL in main settings
# Replacement for TransactionMiddleware
# DATABASES['default']['ATOMIC_REQUESTS'] = True

# FIXME Kobocat migration: Duplicate
# ALLOWED_HOSTS = env.str('DJANGO_ALLOWED_HOSTS', '*').split(' ')
#
# # Domain must not exclude KPI when sharing sessions
# SESSION_COOKIE_DOMAIN = env.str('SESSION_COOKIE_DOMAIN', None)
# if SESSION_COOKIE_DOMAIN:
#     SESSION_COOKIE_NAME = env.str('SESSION_COOKIE_NAME', 'kobonaut')

# FIXME Kobocat migration: Does it break KPI? that's the default value. Should get rid of it?
SESSION_SERIALIZER = 'django.contrib.sessions.serializers.JSONSerializer'

# FIXME Kobocat migration: Validate if we use only one storage
# # If not properly overridden, leave uninitialized so Django can set the default.
# # (see https://docs.djangoproject.com/en/1.8/ref/settings/#default-file-storage)
# if os.environ.get('KOBOCAT_DEFAULT_FILE_STORAGE'):
#     DEFAULT_FILE_STORAGE = env.str('KOBOCAT_DEFAULT_FILE_STORAGE')
#     if DEFAULT_FILE_STORAGE == 'storages.backends.s3boto3.S3Boto3Storage':
#         # Force usage of custom S3 tellable Storage
#         DEFAULT_FILE_STORAGE = 'kobo.apps.openrosa.apps.storage_backends.s3boto3.S3Boto3Storage'

# EMAIL_BACKEND = env.str(
#     'EMAIL_BACKEND', 'django.core.mail.backends.filebased.EmailBackend'
# )

# FIXME Kobocat migration: Duplicate
# if EMAIL_BACKEND == 'django.core.mail.backends.filebased.EmailBackend':
#     EMAIL_FILE_PATH = env.str('EMAIL_FILE_PATH', os.path.join(PROJECT_ROOT, 'emails'))
#     if not os.path.isdir(EMAIL_FILE_PATH):
#         os.mkdir(EMAIL_FILE_PATH)

# FIXME Kobocat migration: Duplicate
# SESSION_ENGINE = 'redis_sessions.session'
# # django-redis-session expects a dictionary with `url`
# redis_session_url = env.cache_url(
#     'REDIS_SESSION_URL', default='redis://redis_cache:6380/2'
# )
# SESSION_REDIS = {
#     'url': redis_session_url['LOCATION'],
#     'prefix': env.str('REDIS_SESSION_PREFIX', 'session'),
#     'socket_timeout': env.int('REDIS_SESSION_SOCKET_TIMEOUT', 1),
# }

# CACHES = {
#     # Set CACHE_URL to override. Only redis is supported.
#     'default': env.cache_url(default='redis://redis_cache:6380/3'),
#     'enketo_redis_main': env.cache_url(
#         'ENKETO_REDIS_MAIN_URL', default='redis://change-me.invalid/0'
#     ),
# }

# FIXME Kobocat migration: Does it break kpi?
DIGEST_NONCE_BACKEND = 'kobo.apps.openrosa.apps.django_digest_backends.cache.RedisCacheNonceStorage'

###################################
# Django Rest Framework settings  #
###################################

# FIXME Kobocat migration: To be merged

# REST_FRAMEWORK = {
#     # Use hyperlinked styles by default.
#     # Only used if the `serializer_class` attribute is not set on a view.
#     'DEFAULT_MODEL_SERIALIZER_CLASS':
#     'rest_framework.serializers.HyperlinkedModelSerializer',
#
#     # Use Django's standard `django.contrib.auth` permissions,
#     # or allow read-only access for unauthenticated users.
#     'DEFAULT_PERMISSION_CLASSES': [
#         'rest_framework.permissions.AllowAny',
#     ],
#     'DEFAULT_AUTHENTICATION_CLASSES': (
#         'kobo.apps.openrosa.libs.authentication.DigestAuthentication',
#         'oauth2_provider.contrib.rest_framework.OAuth2Authentication',
#         'kobo.apps.openrosa.libs.authentication.TokenAuthentication',
#         # HttpsOnlyBasicAuthentication must come before SessionAuthentication because
#         # Django authentication is called before DRF authentication and users get authenticated with
#         # Session if it comes first (which bypass BasicAuthentication and MFA validation)
#         'kobo.apps.openrosa.libs.authentication.HttpsOnlyBasicAuthentication',
#         'rest_framework.authentication.SessionAuthentication',
#         'kobo_service_account.authentication.ServiceAccountAuthentication',
#     ),
#     'DEFAULT_RENDERER_CLASSES': (
#         # Keep JSONRenderer at the top "in order to send JSON responses to
#         # clients that do not specify an Accept header." See
#         # http://www.django-rest-framework.org/api-guide/renderers/#ordering-of-renderer-classes
#         'rest_framework.renderers.JSONRenderer',
#         'rest_framework_jsonp.renderers.JSONPRenderer',
#         'rest_framework.renderers.BrowsableAPIRenderer',
#         'rest_framework_xml.renderers.XMLRenderer',
#         'rest_framework_csv.renderers.CSVRenderer',
#     ),
#     'VIEW_NAME_FUNCTION': 'kobo.apps.openrosa.apps.api.tools.get_view_name',
#     'VIEW_DESCRIPTION_FUNCTION': 'kobo.apps.openrosa.apps.api.tools.get_view_description',
# }

# DEFAULT_AUTO_FIELD = 'django.db.models.AutoField'

################################
# KoBoCAT settings             #
################################

# FIXME Kobocat migration: Duplicate with TESTING in KPI. Merge code
TESTING_MODE = False

# needed by guardian`
# Deprecated since v1.4.2. ToDo move to constants.py`
# ANONYMOUS_USER_ID = -1
# Needed to get ANONYMOUS_USER = -1
GUARDIAN_GET_INIT_ANONYMOUS_USER = 'kobo.apps.openrosa.apps.main.models.user_profile.get_anonymous_user_instance'  # noqa


# FIXME Kobocat migration: Duplicate. To be merged
KOBOCAT_URL = env.url('KOBOCAT_URL', 'http://kc.kobo.local').geturl()
KOBOFORM_SERVER = env.str('KOBOFORM_SERVER', 'localhost')
KOBOFORM_SERVER_PORT = env.str('KOBOFORM_SERVER_PORT', '8000')
KOBOFORM_SERVER_PROTOCOL = env.str('KOBOFORM_SERVER_PROTOCOL', 'http')
KOBOFORM_LOGIN_AUTOREDIRECT = True
KOBOFORM_URL = env.url('KOBOFORM_URL', 'http://kf.kobo.local').geturl()
KOBOFORM_INTERNAL_URL = env.url('KOBOFORM_INTERNAL_URL', KOBOFORM_URL).geturl()

KPI_HOOK_ENDPOINT_PATTERN = '/api/v2/assets/{asset_uid}/hook-signal/'


# FIXME Kobocat migration: Does it change something for KPI
OAUTH2_PROVIDER = {
    # this is the list of available scopes
    'SCOPES': {
        'read': 'Read scope',
        'write': 'Write scope',
        'groups': 'Access to your groups'
    },
    'PKCE_REQUIRED': False,
}

# # All registration should be done through KPI, so Django Registration should
# # never be enabled here. It'd be best to remove all references to the
# # `registration` app in the future.
# REGISTRATION_OPEN = False
# ACCOUNT_ACTIVATION_DAYS = 1

SWAGGER_SETTINGS = {
    'exclude_namespaces': [],    # List URL namespaces to ignore
    'api_version': '1.0',  # Specify your API's version (optional)
    'enabled_methods': [         # Methods to enable in UI
        'get',
        'post',
        'put',
        'patch',
        'delete'
    ],
}

# CORS policies
CORS_ORIGIN_ALLOW_ALL = False
CORS_ALLOW_CREDENTIALS = True
CORS_ORIGIN_WHITELIST = (
    'http://kc.kobo.local',
)

# FIXME Kobocat migration: Duplicate with KOBOCAT_THUMBNAILS_SUFFIX_MAPPING
THUMB_CONF = {
    'large': {'size': 1280, 'suffix': '-large'},
    'medium': {'size': 640, 'suffix': '-medium'},
    'small': {'size': 240, 'suffix': '-small'},
}
# order of thumbnails from largest to smallest
THUMB_ORDER = ['large', 'medium', 'small']

# FIXME Kobocat migration: Merge all AWS settings.
# # Number of times Celery retries to send data to external rest service
# REST_SERVICE_MAX_RETRIES = 3
#
# # BEGIN external service integration codes
# # ToDo Replace `KOBOCAT_AWS_*` with `AWS_*` . Only one account for
# # both KPI and KoBoCAT is supported anyway
# AWS_ACCESS_KEY_ID = os.environ.get('KOBOCAT_AWS_ACCESS_KEY_ID')
# AWS_SECRET_ACCESS_KEY = os.environ.get('KOBOCAT_AWS_SECRET_ACCESS_KEY')
# # Currently it is possible (though unlikely and not recommended?) to use
# # separate buckets for KPI and KoBoCAT. Doing so relies on
# # `KOBOCAT_AWS_STORAGE_BUCKET_NAME` being present in the environment for KPI
# AWS_STORAGE_BUCKET_NAME = os.environ.get('KOBOCAT_AWS_STORAGE_BUCKET_NAME')
# AWS_DEFAULT_ACL = 'private'
# AWS_S3_FILE_BUFFER_SIZE = 50 * 1024 * 1024
# AWS_S3_SIGNATURE_VERSION = env.str('AWS_S3_SIGNATURE_VERSION', 's3v4')
# if env.str('AWS_S3_REGION_NAME', False):
#     AWS_S3_REGION_NAME = env.str('AWS_S3_REGION_NAME')

# FIXME Kobocat migration: Not used? Delete me.
# AWS_QUERYSTRING_EXPIRE = env.int("KOBOCAT_AWS_QUERYSTRING_EXPIRE", 3600)
# AWS_S3_USE_SSL = env.bool("KOBOCAT_AWS_S3_USE_SSL", True)
# AWS_S3_HOST = env.str("KOBOCAT_AWS_S3_HOST", "s3.amazonaws.com")

# if 'AZURE_ACCOUNT_NAME' in os.environ:
#     AZURE_ACCOUNT_NAME = env.str('AZURE_ACCOUNT_NAME')
#     AZURE_ACCOUNT_KEY = env.str('AZURE_ACCOUNT_KEY')
#     AZURE_CONTAINER = env.str('AZURE_CONTAINER')
#     AZURE_URL_EXPIRATION_SECS = env.int('AZURE_URL_EXPIRATION_SECS', None)

GOOGLE_ANALYTICS_PROPERTY_ID = env.str("GOOGLE_ANALYTICS_TOKEN", False)
GOOGLE_ANALYTICS_DOMAIN = "auto"

# duration to keep zip exports before deletion (in seconds)
ZIP_EXPORT_COUNTDOWN = 24 * 60 * 60

# FIXME Kobocat migration: Use OPENROSA_DEFAULT_CONTENT_LENGTH from main base.py
# # default content length for submission requests
# DEFAULT_CONTENT_LENGTH = 10000000

# Use 1 or 0 for multiple selects instead of True or False for csv, xls exports
BINARY_SELECT_MULTIPLES = False

# Use 'n/a' for empty values by default on csv exports
NA_REP = 'n/a'

# # Content Security Policy (CSP)

# FIXME Kobocat migration: Duplicate. Are CSP settings different from KPI?
# # CSP should "just work" by allowing any possible configuration
# # however CSP_EXTRA_DEFAULT_SRC is provided to allow for custom additions
# if env.bool("ENABLE_CSP", False):
#     MIDDLEWARE.append('csp.middleware.CSPMiddleware')
# CSP_DEFAULT_SRC = env.list('CSP_EXTRA_DEFAULT_SRC', str, []) + ["'self'"]
# CSP_CONNECT_SRC = CSP_DEFAULT_SRC
# CSP_SCRIPT_SRC = CSP_DEFAULT_SRC + ["'unsafe-inline'"]
# CSP_STYLE_SRC = CSP_DEFAULT_SRC + ["'unsafe-inline'"]
# CSP_IMG_SRC = CSP_DEFAULT_SRC + ['data:']
# if GOOGLE_ANALYTICS_PROPERTY_ID:
#     google_domain = '*.google-analytics.com'
#     CSP_SCRIPT_SRC.append(google_domain)
#     CSP_CONNECT_SRC.append(google_domain)
# csp_report_uri = env.url('CSP_REPORT_URI', None)
# if csp_report_uri:  # Let environ validate uri, but set as string
#     CSP_REPORT_URI = csp_report_uri.geturl()
# CSP_REPORT_ONLY = env.bool("CSP_REPORT_ONLY", False)

SUPPORTED_MEDIA_UPLOAD_TYPES = [
    'image/jpeg',
    'image/png',
    'image/svg+xml',
    'video/3gpp',
    'video/mp4',
    'video/quicktime',
    'video/ogg',
    'video/webm',
    'audio/aac',
    'audio/aacp',
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
    'application/x-zip-compressed'
]

# FIXME Kobocat migration: Should get rid of complexity of this code. Color, Label have never been used.
DEFAULT_VALIDATION_STATUSES = [
    {
        'uid': 'validation_status_not_approved',
        'color': '#ff0000',
        'label': 'Not Approved'
    },
    {
        'uid': 'validation_status_approved',
        'color': '#00ff00',
        'label': 'Approved'
    },
    {
        'uid': 'validation_status_on_hold',
        'color': '#0000ff',
        'label': 'On Hold'
    },
]

# # Expiration time in sec. after which the hash of paired data xml file should be
# # validated.
# # Does not need to match KPI setting
# PAIRED_DATA_EXPIRATION = 300
#
# # Minimum size (in bytes) of files to allow fast calculation of hashes
# # Should match KoBoCAT setting
# HASH_BIG_FILE_SIZE_THRESHOLD = 0.5 * 1024 * 1024  # 512 kB
#
# # Chunk size in bytes to read per iteration when hash of a file is calculated
# # Should match KoBoCAT setting
# HASH_BIG_FILE_CHUNK = 16 * 1024  # 16 kB
#
# # PostgreSQL is considered as the default engine. Some DB queries
# # rely on PostgreSQL engine to be executed. It needs to be set to `False` if
# # the database is SQLite (e.g.: running unit tests locally).
USE_POSTGRESQL = True

# Added this because of https://github.com/onaio/kobo.apps.open_rosa_server/pull/2139
# Should bring support to ODK v1.17+
SUPPORT_BRIEFCASE_SUBMISSION_DATE = (
    os.environ.get('SUPPORT_BRIEFCASE_SUBMISSION_DATE') != 'True'
)

# Session Authentication is supported by default, no need to add it to supported classes
MFA_SUPPORTED_AUTH_CLASSES = [
    'kobo.apps.openrosa.libs.authentication.TokenAuthentication',
]

# Set the maximum number of days daily counters can be kept for
DAILY_COUNTERS_MAX_DAYS = env.int('DAILY_COUNTERS_MAX_DAYS', 366)

# FIXME Kobocat migration: Duplicate (merge WHITELISTED_HOSTS env var in KPI container)
# SERVICE_ACCOUNT = {
#     'BACKEND': env.cache_url(
#         'SERVICE_ACCOUNT_BACKEND_URL', default='redis://redis_cache:6380/6'
#     ),
#     'WHITELISTED_HOSTS': env.list('SERVICE_ACCOUNT_WHITELISTED_HOSTS', default=[]),
# }

REVERSION_MIDDLEWARE_SKIPPED_URL_PATTERNS = {
    r'/api/v1/users/(.*)': ['DELETE']
}

# run heavy migration scripts by default
# NOTE: this should be set to False for major deployments. This can take a long time
# SKIP_HEAVY_MIGRATIONS = env.bool('SKIP_HEAVY_MIGRATIONS', False)

################################
# Celery settings              #
################################

# FIXME Kobocat migration: Duplicate
# CELERY_BROKER_URL = os.environ.get(
#     'KOBOCAT_BROKER_URL', 'redis://localhost:6379/2')
#
# CELERY_RESULT_BACKEND = CELERY_BROKER_URL

#
# CELERY_TASK_ALWAYS_EAGER = env.bool('SKIP_CELERY', False)
#
# # Celery defaults to having as many workers as there are cores. To avoid
# # excessive resource consumption, don't spawn more than 6 workers by default
# # even if there are more than 6 cores.
# CELERY_WORKER_MAX_CONCURRENCY = int(os.environ.get('CELERYD_MAX_CONCURRENCY', 6))
# if multiprocessing.cpu_count() > CELERY_WORKER_MAX_CONCURRENCY:
#     CELERY_WORKER_CONCURRENCY = CELERY_WORKER_MAX_CONCURRENCY
#
# # Replace a worker after it completes 7 tasks by default. This allows the OS to
# # reclaim memory allocated during large tasks
# CELERY_WORKER_MAX_TASKS_PER_CHILD = int(os.environ.get(
#     'CELERYD_MAX_TASKS_PER_CHILD', 7))
#
# # Default to a 30-minute soft time limit and a 35-minute hard time limit
# CELERY_TASK_TIME_LIMIT = int(os.environ.get('CELERY_TASK_TIME_LIMIT', 2100))
# CELERY_TASK_SOFT_TIME_LIMIT = int(os.environ.get(
#     'CELERYD_TASK_SOFT_TIME_LIMIT', 1800))
#
# CELERY_BROKER_TRANSPORT_OPTIONS = {
#     "fanout_patterns": True,
#     "fanout_prefix": True,
#     # http://docs.celeryproject.org/en/latest/getting-started/brokers/redis.html#redis-visibility-timeout
#     "visibility_timeout": 120 * (10 ** REST_SERVICE_MAX_RETRIES)  # Longest ETA for RestService
# }

# FIXME Kobocat migration: To be merged
CELERY_BEAT_SCHEDULE = {
    # Periodically mark exports stuck in the "pending" state as "failed"
    # See https://github.com/kobotoolbox/kobocat/issues/315
    'log-stuck-exports-and-mark-failed': {
        'task': 'kobo.apps.openrosa.apps.viewer.tasks.log_stuck_exports_and_mark_failed',
        'schedule': timedelta(hours=6),
        'options': {'queue': 'kobocat_queue'}
    },
    'delete-daily-xform-submissions-counter': {
        'task': 'kobo.apps.openrosa.apps.logger.tasks.delete_daily_counters',
        'schedule': crontab(hour=0, minute=0),
        'options': {'queue': 'kobocat_queue'}
    }
}

# FIXME Kobocat migration: Remove, handle queue with CELERY_TASK_ROUTES
CELERY_TASK_DEFAULT_QUEUE = "kobocat_queue"

# FIXME Kobocat migration: Duplicate
#
# ################################
# # Enketo Express settings      #
# ################################
#
# ENKETO_URL = os.environ.get('ENKETO_URL', 'https://enketo.kobotoolbox.org')
#
# ENKETO_URL = ENKETO_URL.rstrip('/')
# ENKETO_API_TOKEN = os.environ.get('ENKETO_API_TOKEN', 'enketorules')
# ENKETO_VERSION = 'express'
#
# # Constants.
# ENKETO_API_ENDPOINT_ONLINE_SURVEYS = '/survey'
# ENKETO_API_ENDPOINT_OFFLINE_SURVEYS = '/survey/offline'
# ENKETO_API_ENDPOINT_INSTANCE = '/instance'
# ENKETO_API_ENDPOINT_INSTANCE_IFRAME = '/instance/iframe'
#
# # Computed settings.
# ENKETO_API_ROOT = '/api/v2'
# ENKETO_OFFLINE_SURVEYS = os.environ.get('ENKETO_OFFLINE_SURVEYS', 'True').lower() == 'true'
# ENKETO_API_ENDPOINT_PREVIEW = '/preview'
# ENKETO_API_ENDPOINT_SURVEYS = ENKETO_API_ENDPOINT_OFFLINE_SURVEYS if ENKETO_OFFLINE_SURVEYS \
#         else ENKETO_API_ENDPOINT_ONLINE_SURVEYS
#
# ENKETO_API_SURVEY_PATH = ENKETO_API_ROOT + ENKETO_API_ENDPOINT_SURVEYS
# ENKETO_API_INSTANCE_PATH = ENKETO_API_ROOT + ENKETO_API_ENDPOINT_INSTANCE
# ENKETO_PREVIEW_URL = ENKETO_URL + ENKETO_API_ENDPOINT_PREVIEW
# ENKETO_API_INSTANCE_IFRAME_URL = ENKETO_URL + ENKETO_API_ROOT + ENKETO_API_ENDPOINT_INSTANCE_IFRAME
#
# # specifically for site urls sent to enketo for form retrieval
# # `ENKETO_PROTOCOL` variable is overridden when internal domain name is used.
# # All internal communications between containers must be HTTP only.
# ENKETO_PROTOCOL = os.environ.get('ENKETO_PROTOCOL', 'https')

#
# ################################
# # MongoDB settings             #
# ################################
# if not (MONGO_DB_URL := env.str('MONGO_DB_URL', False)):
#     # ToDo Remove all this block by the end of 2022.
#     #   Update kobo-install accordingly
#     logging.warning(
#         '`MONGO_DB_URL` is not found. '
#         '`KOBOCAT_MONGO_HOST`, `KOBOCAT_MONGO_PORT`, `KOBOCAT_MONGO_NAME`, '
#         '`KOBOCAT_MONGO_USER`, `KOBOCAT_MONGO_PASS` '
#         'are deprecated and will not be supported anymore soon.'
#     )
#
#     MONGO_DATABASE = {
#         'HOST': os.environ.get('KOBOCAT_MONGO_HOST', 'mongo'),
#         'PORT': int(os.environ.get('KOBOCAT_MONGO_PORT', 27017)),
#         'NAME': os.environ.get('KOBOCAT_MONGO_NAME', 'formhub'),
#         'USER': os.environ.get('KOBOCAT_MONGO_USER', ''),
#         'PASSWORD': os.environ.get('KOBOCAT_MONGO_PASS', '')
#     }
#
#     if MONGO_DATABASE.get('USER') and MONGO_DATABASE.get('PASSWORD'):
#         MONGO_DB_URL = "mongodb://{user}:{password}@{host}:{port}/{db_name}".\
#             format(
#                 user=MONGO_DATABASE['USER'],
#                 password=quote_plus(MONGO_DATABASE['PASSWORD']),
#                 host=MONGO_DATABASE['HOST'],
#                 port=MONGO_DATABASE['PORT'],
#                 db_name=MONGO_DATABASE['NAME']
#             )
#     else:
#         MONGO_DB_URL = "mongodb://%(HOST)s:%(PORT)s/%(NAME)s" % MONGO_DATABASE
#     mongo_db_name = MONGO_DATABASE['NAME']
# else:
#     # Attempt to get collection name from the connection string
#     # fallback on MONGO_DB_NAME or 'formhub' if it is empty or None or unable to parse
#     try:
#         mongo_db_name = env.db_url('MONGO_DB_URL').get('NAME') or env.str('MONGO_DB_NAME', 'formhub')
#     except ValueError:  # db_url is unable to parse replica set strings
#         mongo_db_name = env.str('MONGO_DB_NAME', 'formhub')
#
# mongo_client = MongoClient(
#     MONGO_DB_URL, connect=False, journal=True, tz_aware=True
# )
# MONGO_DB = mongo_client[mongo_db_name]
#
# # Timeout for Mongo, must be, at least, as long as Celery timeout.
# MONGO_DB_MAX_TIME_MS = CELERY_TASK_TIME_LIMIT * 1000
#


# FIXME Kobocat migration: Sentry will use only one provider
# ################################
# # Sentry settings              #
# ################################
# sentry_dsn = env.str('SENTRY_DSN', env.str('RAVEN_DSN', None))
# if sentry_dsn:
#     import sentry_sdk
#     from sentry_sdk.integrations.django import DjangoIntegration
#     from sentry_sdk.integrations.celery import CeleryIntegration
#     from sentry_sdk.integrations.logging import LoggingIntegration
#
#     # All of this is already happening by default!
#     sentry_logging = LoggingIntegration(
#         level=logging.INFO,  # Capture info and above as breadcrumbs
#         event_level=logging.ERROR  # Send errors as events
#     )
#     sentry_sdk.init(
#         dsn=sentry_dsn,
#         integrations=[
#             DjangoIntegration(),
#             CeleryIntegration(),
#             sentry_logging
#         ],
#         traces_sample_rate=env.float('SENTRY_TRACES_SAMPLE_RATE', 0.01),
#         send_default_pii=True
#     )
