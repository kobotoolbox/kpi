# coding: utf-8
import json
import logging

import constance
from allauth.socialaccount.models import SocialApp
from django.conf import settings
from django.core.exceptions import MultipleObjectsReturned
from django.db.models import Q
from django.utils.translation import gettext_lazy as t
from markdown import markdown
from rest_framework.response import Response
from rest_framework.views import APIView

from hub.models.sitewide_message import SitewideMessage
from hub.utils.i18n import I18nUtils
from kobo.apps.accounts.mfa.models import MfaAvailableToUser
from kobo.apps.constance_backends.utils import to_python_object
from kobo.apps.hook.constants import SUBMISSION_PLACEHOLDER
from kobo.apps.organizations.models import OrganizationOwner
from kobo.apps.stripe.constants import FREE_TIER_EMPTY_DISPLAY, FREE_TIER_NO_THRESHOLDS
from kobo.static_lists import COUNTRIES
from kpi.utils.object_permission import get_database_user


def check_asr_mt_access_for_user(user):
    # This is for proof-of-concept testing and will be replaced with proper
    # quotas and accounting
    if user.is_anonymous:
        return False
    asr_mt_invitees = constance.config.ASR_MT_INVITEE_USERNAMES
    return (
        asr_mt_invitees.strip() == '*'
        or user.username in asr_mt_invitees.split('\n')
    )


class EnvironmentView(APIView):
    """
    GET-only view for certain server-provided configuration data
    """

    SIMPLE_CONFIGS = [
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
    ]

    OTHER_CONFIGS = [
        'PROJECT_HISTORY_LOG_LIFESPAN',
    ]

    @classmethod
    def process_simple_configs(cls):
        return {
            key.lower(): getattr(constance.config, key)
            for key in cls.SIMPLE_CONFIGS
        }

    JSON_CONFIGS = [
        'FREE_TIER_DISPLAY',
        'FREE_TIER_THRESHOLDS',
    ]

    def get(self, request, *args, **kwargs):
        data = {}
        data.update(self.process_simple_configs())
        data.update(self.process_json_configs())
        data.update(self.process_choice_configs())
        data.update(self.process_mfa_configs(request))
        data.update(self.process_password_configs(request))
        data.update(self.process_project_metadata_configs(request))
        data.update(self.process_user_metadata_configs(request))
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
            for v in cls.split_with_newline_kludge(
                constance.config.SECTOR_CHOICES
            )
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

    @classmethod
    def process_json_configs(cls):
        data = {}
        for key in cls.JSON_CONFIGS:
            value = getattr(constance.config, key)
            try:
                value = to_python_object(value)
            except json.JSONDecodeError:
                logging.error(
                    f'Configuration value for `{key}` has invalid JSON'
                )
                continue
            data[key.lower()] = value
        return data

    @staticmethod
    def process_mfa_configs(request):
        data = {}
        data['mfa_localized_help_text'] = markdown(
            I18nUtils.get_mfa_help_text()
        )
        data['mfa_enabled'] = constance.config.MFA_ENABLED
        data['mfa_per_user_availability'] = MfaAvailableToUser.objects.filter(
            user=get_database_user(request.user)
        ).exists()
        data['mfa_has_availability_list'] = MfaAvailableToUser.objects.all().exists()
        data['mfa_code_length'] = settings.TRENCH_AUTH['CODE_LENGTH']
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
        data = {
            'project_metadata_fields': I18nUtils.get_metadata_fields('project')
        }
        return data

    @staticmethod
    def process_other_configs(request):
        data = {}

        data['social_apps'] = list(
            (SocialApp.objects.filter(Q(custom_data__is_public=True) | Q(custom_data__isnull=True))).values(
                'provider', 'name', 'client_id', 'provider_id'
            )
        )

        data['asr_mt_features_enabled'] = check_asr_mt_access_for_user(request.user)
        data['submission_placeholder'] = SUBMISSION_PLACEHOLDER

        for key in EnvironmentView.OTHER_CONFIGS:
            data[key.lower()] = getattr(constance.config, key)

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

        # If the user isn't eligible for the free tier override, don't send free tier data to the frontend
        if request.user.id:
            # if the user is in an organization, use the organization owner's join date
            owner_join_date = OrganizationOwner.objects.filter(
                organization__organization_users__user=request.user
            ).values_list('organization_user__user__date_joined', flat=True).first()
            if owner_join_date:
                date_joined = owner_join_date.date()
            else:
                # default to checking the user's join date
                date_joined = request.user.date_joined.date()
            # if they didn't register on/before FREE_TIER_CUTOFF_DATE, don't display the custom free tier
            if date_joined > constance.config.FREE_TIER_CUTOFF_DATE:
                data['free_tier_thresholds'] = FREE_TIER_NO_THRESHOLDS
                data['free_tier_display'] = FREE_TIER_EMPTY_DISPLAY

        data[
            'terms_of_service__sitewidemessage__exists'
        ] = SitewideMessage.objects.filter(slug='terms_of_service').exists()

        return data

    @staticmethod
    def process_user_metadata_configs(request):
        data = {
            'user_metadata_fields': I18nUtils.get_metadata_fields('user')
        }
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
