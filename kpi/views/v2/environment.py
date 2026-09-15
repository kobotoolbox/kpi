import constance
from allauth.account import app_settings as allauth_account_settings
from allauth.socialaccount.models import SocialApp
from django.conf import settings
from django.contrib.postgres.aggregates import ArrayAgg
from django.core.exceptions import MultipleObjectsReturned
from django.db.models import Case, F, Q, Value, When
from django.utils.translation import gettext_lazy as t
from drf_spectacular.utils import extend_schema
from markdown import markdown
from rest_framework.response import Response
from rest_framework.views import APIView

from hub.models.configuration_file import ConfigurationFile, ConfigurationFileSlug
from hub.models.sitewide_message import SitewideMessage
from hub.utils.i18n import I18nUtils
from kobo.apps.hook.constants import SUBMISSION_PLACEHOLDER
from kobo.static_lists import COUNTRIES
from kpi.constants import AUTH_THEME_CUSTOM, AUTH_THEME_DEFAULT
from kpi.models import ExtraProjectMetadataField
from kpi.schema_extensions.v2.environment.serializers import (
    EnvironmentResponseSerializer,
)
from kpi.utils.markdown import markdownify
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import open_api_200_ok_response
from kpi.versioning import APIV2Versioning


def check_asr_mt_access_for_user(user):
    # This is for proof-of-concept testing and will be replaced with proper
    # quotas and accounting
    if user.is_anonymous:
        return False
    asr_mt_invitees = constance.config.ASR_MT_INVITEE_USERNAMES
    return asr_mt_invitees.strip() == '*' or user.username in asr_mt_invitees.split(
        '\n'
    )


class EnvironmentView(APIView):
    """
    GET-only view for certain server-provided configuration data

    Available actions:
    - retrieve              → GET /environment/

    Documentation:
    - docs/api/v2/environment/retrieve.md
    """

    SIMPLE_CONFIGS = [
        'REGISTRATION_OPEN',
        'TERMS_OF_SERVICE_URL',
        'PRIVACY_POLICY_URL',
        'SOURCE_CODE_URL',
        'SUPPORT_EMAIL',
        'SUPPORT_URL',
        'ACADEMY_URL',
        'COMMUNITY_URL',
        'FRONTEND_MIN_RETRY_TIME',
        'FRONTEND_MAX_RETRY_TIME',
        'USE_TEAM_LABEL',
        'USAGE_LIMIT_ENFORCEMENT',
        'ALLOW_SELF_ACCOUNT_DELETION',
    ]

    OTHER_CONFIGS = [
        'PROJECT_HISTORY_LOG_LIFESPAN',
    ]

    versioning_class = APIV2Versioning

    @classmethod
    def process_simple_configs(cls):
        return {
            key.lower(): getattr(constance.config, key) for key in cls.SIMPLE_CONFIGS
        }

    @extend_schema(
        tags=['Configuration'],
        description=read_md('kpi', 'environment/retrieve.md'),
        responses=open_api_200_ok_response(
            EnvironmentResponseSerializer,
            raise_not_found=False,
            raise_access_forbidden=False,
            require_auth=False,
            validate_payload=False,
        ),
    )
    def get(self, request, *args, **kwargs):
        data = {}
        data.update(self.process_simple_configs())
        data.update(self.process_choice_configs())
        data.update(self.process_mfa_configs(request))
        data.update(self.process_password_configs(request))
        data.update(self.process_project_metadata_configs(request))
        data.update(self.process_extra_project_metadata_configs(request))
        data.update(self.process_user_metadata_configs(request))
        data.update(self.process_auth_configs(request))
        data.update(self.process_other_configs(request))
        data.update(self.static_configs(request))
        return Response(data)

    @classmethod
    def process_choice_configs(cls):
        """
        A value with one choice per line gets expanded to a tuple of
        (value, label) tuples
        """
        data = {}
        data['sector_choices'] = tuple(
            # Intentional t() call on dynamic string because the default
            # choices are translated; see static_lists.py
            (v, t(v))
            for v in cls.split_with_newline_kludge(constance.config.SECTOR_CHOICES)
        )
        data['operational_purpose_choices'] = tuple(
            (v, v)
            for v in cls.split_with_newline_kludge(
                constance.config.OPERATIONAL_PURPOSE_CHOICES
            )
        )
        data['country_choices'] = COUNTRIES
        data['interface_languages'] = settings.LANGUAGES
        return data

    @staticmethod
    def process_extra_project_metadata_configs(request):
        fields = ExtraProjectMetadataField.objects.all()

        extra_fields_data = []
        for field in fields:
            extra_fields_data.append(
                {
                    'name': field.name,
                    'label': field.label,
                    'type': field.type,
                    'required': field.is_required,
                    'options': field.options,
                }
            )

        return {'extra_project_metadata_fields': extra_fields_data}

    @staticmethod
    def process_mfa_configs(request):
        data = {}
        data['mfa_localized_help_text'] = markdown(I18nUtils.get_mfa_help_text())
        data['mfa_enabled'] = constance.config.MFA_ENABLED
        data['mfa_code_length'] = settings.MFA_TOTP_DIGITS
        data['superuser_auth_enforcement'] = constance.config.SUPERUSER_AUTH_ENFORCEMENT
        return data

    @staticmethod
    def process_password_configs(request):
        return {
            'enable_password_entropy_meter': (
                constance.config.ENABLE_PASSWORD_ENTROPY_METER
            ),
            'enable_custom_password_guidance_text': (
                constance.config.ENABLE_CUSTOM_PASSWORD_GUIDANCE_TEXT
            ),
            'custom_password_localized_help_text': markdown(
                I18nUtils.get_custom_password_help_text()
            ),
        }

    @staticmethod
    def process_project_metadata_configs(request):
        data = {'project_metadata_fields': I18nUtils.get_metadata_fields('project')}
        return data

    @staticmethod
    def process_other_configs(request):
        data = {}
        social_apps = (
            SocialApp.objects.select_related('custom_data')
            .prefetch_related('custom_data__domains')
            .filter(Q(custom_data__is_public=True) | Q(custom_data__isnull=True))
            # managed iff there exists a related SocialAppCustomData object with
            # managed=True
            .annotate(
                managed=Case(
                    When(
                        custom_data__managed__isnull=False,
                        then=F('custom_data__managed'),
                    ),
                    default=Value(False),
                )
            )
            .values('provider', 'name', 'client_id', 'provider_id', 'managed')
            # list all managed domains associated with the SocialAppCustomData object.
            # filter + default so we get an empty array if there are none rather than
            # [None]
            .annotate(
                domains=ArrayAgg(
                    'custom_data__domains__domain',
                    filter=Q(custom_data__domains__domain__isnull=False),
                    default=Value([]),
                )
            )
        )
        data['social_apps'] = list(social_apps)
        data['asr_mt_features_enabled'] = check_asr_mt_access_for_user(request.user)
        data['submission_placeholder'] = SUBMISSION_PLACEHOLDER

        for key in EnvironmentView.OTHER_CONFIGS:
            result = getattr(constance.config, key, None)
            if result is None:
                result = getattr(settings, key)
            data[key.lower()] = result

        if settings.STRIPE_ENABLED:
            from djstripe.models import APIKey

            try:
                data['stripe_public_key'] = str(
                    APIKey.objects.get(
                        type='publishable', livemode=settings.STRIPE_LIVE_MODE
                    ).secret
                )
            except MultipleObjectsReturned as e:
                raise MultipleObjectsReturned(
                    'Remove extra api keys from the django admin.'
                ) from e
            except APIKey.DoesNotExist as e:
                raise APIKey.DoesNotExist(
                    'Add a stripe api key to the django admin.'
                ) from e
        else:
            data['stripe_public_key'] = None

        data['terms_of_service__sitewidemessage__exists'] = (
            SitewideMessage.objects.filter(slug='terms_of_service').exists()
        )

        return data

    @staticmethod
    def process_auth_configs(request):
        """
        Branding and behaviour of the sign-in and account creation screens
        """
        configuration_files = {
            configuration_file.slug: configuration_file.url
            for configuration_file in ConfigurationFile.objects.filter(
                slug__in=[
                    ConfigurationFileSlug.LOGO,
                    ConfigurationFileSlug.LOGIN_BACKGROUND,
                    ConfigurationFileSlug.LOGIN_SUPPORTING_IMAGE,
                ]
            )
        }
        background_image_url = configuration_files.get(
            ConfigurationFileSlug.LOGIN_BACKGROUND
        )
        # Localized for the request language, falling back to the untranslated
        # message; `None` when no administrator has written one
        supporting_text = I18nUtils.get_sitewide_message()

        return {
            'auth_configuration': {
                # Uploading a background image is what selects the customizable
                # theme: the default theme does not allow one, so the two are
                # the same fact and are deliberately not stored separately
                'theme': (
                    AUTH_THEME_CUSTOM if background_image_url else AUTH_THEME_DEFAULT
                ),
                'background_image_url': background_image_url,
                'show_kobotoolbox_logo': constance.config.SHOW_KOBOTOOLBOX_LOGO,
                'logo_url': configuration_files.get(ConfigurationFileSlug.LOGO),
                'supporting_image_url': configuration_files.get(
                    ConfigurationFileSlug.LOGIN_SUPPORTING_IMAGE
                ),
                'supporting_text': (
                    markdownify(supporting_text) if supporting_text else ''
                ),
                # Reported, not configured: follows allauth's accepted
                # login methods, so the form never offers a credential the
                # server would reject
                'allow_login_with_username': (
                    allauth_account_settings.LoginMethod.USERNAME
                    in allauth_account_settings.LOGIN_METHODS
                ),
            }
        }

    @staticmethod
    def process_user_metadata_configs(request):
        data = {'user_metadata_fields': I18nUtils.get_metadata_fields('user')}
        return data

    @staticmethod
    def split_with_newline_kludge(value):
        """
        django-constance formerly (before 2.7) used `\r\n` for newlines but
        later changed that to `\n` alone. See #3825, #3831. This fix-up process
        is *only* needed for settings that existed prior to this change; do not
        use it when adding new settings.
        """
        return (line.strip('\r') for line in value.split('\n'))

    def static_configs(self, request):
        return {'open_rosa_server': settings.KOBOCAT_URL}
