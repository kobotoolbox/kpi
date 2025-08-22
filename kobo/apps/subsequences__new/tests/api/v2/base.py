import uuid
from copy import deepcopy
from unittest.mock import Mock, patch

import pytest
from constance.test import override_config
from django.conf import settings
from django.test import override_settings
from django.urls import reverse
from google.cloud import translate_v3
from jsonschema import validate
from rest_framework import status
from rest_framework.test import APITestCase

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.languages.models.language import Language, LanguageRegion
from kobo.apps.languages.models.transcription import (
    TranscriptionService,
    TranscriptionServiceLanguageM2M,
)
from kobo.apps.languages.models.translation import (
    TranslationService,
    TranslationServiceLanguageM2M,
)
from kobo.apps.openrosa.apps.logger.models import Instance
from kobo.apps.openrosa.apps.logger.xform_instance_parser import add_uuid_prefix
from kobo.apps.organizations.constants import UsageType
from kpi.constants import (
    PERM_ADD_SUBMISSIONS,
    PERM_CHANGE_ASSET,
    PERM_CHANGE_SUBMISSIONS,
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VIEW_ASSET,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.models.asset import Asset
from kpi.tests.base_test_case import BaseTestCase
from kpi.tests.kpi_test_case import KpiTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE
from kpi.utils.fuzzy_int import FuzzyInt
from kpi.utils.xml import (
    edit_submission_xml,
    fromstring_preserve_root_xmlns,
    xml_tostring,
)


class SubsequenceBaseTestCase(KpiTestCase):

    fixtures = ['test_data']
    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        user = User.objects.get(username='someuser')
        self.asset = Asset(
            owner=user,
            content={'survey': [{'type': 'audio', 'label': 'q1', 'name': 'q1'}]},
        )
        self.asset.advanced_features = {}
        self.asset.save()
        self.asset.deploy(backend='mock', active=True)
        self.asset_uid = self.asset.uid
        self.asset_url = reverse(
            self._get_endpoint('asset-detail'), args=[self.asset_uid]
        )

        uuid_ = uuid.uuid4()
        self.submission_uuid = str(uuid_)

        # add a submission
        submission_data = {
            'q1': 'answer',
            '_uuid': self.submission_uuid,
            '_submitted_by': 'someuser',
        }

        self.asset.deployment.mock_submissions([submission_data])
        self.client.force_login(user)
        self.supplement_details_url = reverse(
            self._get_endpoint('submission-supplement'),
            args=[self.asset.uid, self.submission_uuid]
        )

    def set_asset_advanced_features(self, features):
        self.asset.advanced_features = features
        self.asset.save(
            adjust_content=False,
            create_version=False,
            update_fields=['advanced_features'],
        )
