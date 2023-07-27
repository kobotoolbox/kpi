# coding: utf-8
import json
import logging

import constance
from django.conf import settings
from django.utils.translation import gettext_lazy as t
from markdown import markdown
from rest_framework.response import Response
from rest_framework.views import APIView
from allauth.socialaccount.models import SocialApp

from hub.utils.i18n import I18nUtils
from kobo.static_lists import COUNTRIES
from kobo.apps.hook.constants import SUBMISSION_PLACEHOLDER
from kobo.apps.accounts.mfa.models import MfaAvailableToUser
from kpi.utils.object_permission import get_database_user


# NOMERGE
FAKE_USER_METADATA_FIELDS = '''
[
  {
    "name": "full_name",
    "label": "Füłł ñámé",
    "required": true
  },
  {
    "name": "organization",
    "label": "Örgáñîzátîöñ",
    "required": true
  },
  {
    "name": "organization_website",
    "label": "Örgáñîzátîöñ wébšîté",
    "required": true
  },
  {
    "name": "sector",
    "label": "Šéćtör",
    "required": true
  },
  {
    "name": "gender",
    "label": "Géñdér",
    "required": true
  },
  {
    "name": "bio",
    "label": "Bîö",
    "required": true
  },
  {
    "name": "city",
    "label": "Ćîtÿ",
    "required": true
  },
  {
    "name": "country",
    "label": "Ćöüñtrÿ",
    "required": true
  },
  {
    "name": "twitter",
    "label": "Twîttér",
    "required": true
  },
  {
    "name": "linkedin",
    "label": "ŁîñkédÎñ",
    "required": true
  },
  {
    "name": "instagram",
    "label": "Îñštágrám",
    "required": true
  }
]
'''.strip()

# NOMERGE
FAKE_PROJECT_METADATA_FIELDS = '''
[
  {
    "name": "sector",
    "label": "Šéćtör",
    "required": true
  },
  {
    "name": "country",
    "label": "Ćöüñtrÿ",
    "required": true
  },
  {
    "name": "operational_purpose",
    "label": "Öpérátîöñáł Pürpöšé",
    "required": true
  },
  {
    "name": "collects_pii",
    "label": "Ćöłłéćtš PÎÎ",
    "required": true
  },
  {
    "name": "description",
    "label": "Déšćrîptîöñ",
    "required": true
  }
]
'''.strip()


def _check_asr_mt_access_for_user(user):
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
        'COMMUNITY_URL',
        'FRONTEND_MIN_RETRY_TIME',
        'FRONTEND_MAX_RETRY_TIME',
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
        'PROJECT_METADATA_FIELDS',
        'USER_METADATA_FIELDS',
    ]

    @classmethod
    def process_json_configs(cls):
        data = {}
        for key in cls.JSON_CONFIGS:
            value = getattr(constance.config, key)
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                logging.error(
                    f'Configuration value for `{key}` has invalid JSON'
                )
                continue
            data[key.lower()] = value
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

    @staticmethod
    def process_mfa_configs(request):
        data = {}
        data['mfa_localized_help_text'] = markdown(
            I18nUtils.get_mfa_help_text()
        )
        data['mfa_enabled'] = (
            # MFA is enabled if it is enabled globally…
            constance.config.MFA_ENABLED
            and (
                # but if per-user activation is enabled (i.e. at least one
                # record in the table)…
                not MfaAvailableToUser.objects.all().exists()
                # global setting is overwritten by request user setting.
                or MfaAvailableToUser.objects.filter(
                    user=get_database_user(request.user)
                ).exists()
            )
        )
        data['mfa_code_length'] = settings.TRENCH_AUTH['CODE_LENGTH']
        return data

    @staticmethod
    def process_other_configs(request):
        data = {}

        # django-allauth social apps are configured in both settings and the
        # database. Optimize by avoiding extra DB call when unnecessary
        social_apps = []
        if settings.SOCIALACCOUNT_PROVIDERS:
            social_apps = list(
                SocialApp.objects.filter(custom_data__isnull=True).values(
                    'provider', 'name', 'client_id'
                )
            )
        data['social_apps'] = social_apps

        data['asr_mt_features_enabled'] = _check_asr_mt_access_for_user(
            request.user
        )
        data['submission_placeholder'] = SUBMISSION_PLACEHOLDER
        data['stripe_public_key'] = (
            settings.STRIPE_PUBLIC_KEY if settings.STRIPE_ENABLED else None
        )

        return data

    def get(self, request, *args, **kwargs):
        data = {}
        data.update(self.process_simple_configs())
        data.update(self.process_json_configs())
        data.update(self.process_choice_configs())
        data.update(self.process_mfa_configs(request))
        data.update(self.process_other_configs(request))
        data['user_metadata_fields'] = json.loads(FAKE_USER_METADATA_FIELDS)  # NOMERGE
        data['project_metadata_fields'] = json.loads(FAKE_PROJECT_METADATA_FIELDS)  # NOMERGE
        return Response(data)
