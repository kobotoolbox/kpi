from datetime import timedelta

import constance
from django.db.models import Q
from django.utils import timezone
from django.utils.translation import gettext as t
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kobo.apps.hook.constants import HOOK_LOG_FAILED, HOOK_LOG_PENDING
from kobo.apps.hook.models import Hook, HookLog
from kobo.apps.hook.serializers.v2.hook import HookSerializer
from kobo.apps.hook.tasks import retry_all_task
from kpi.permissions import AssetEditorSubmissionViewerPermission
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin
from kpi.permissions import IsAuthenticated
from ..models.transfer import Transfer


class TransferViewSet(viewsets.ModelViewSet):

    model = Transfer
    lookup_field = 'uid'
    serializer_class = TransferSerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):

        queryset = self.model.objects.filter(asset__uid=self.asset.uid)
        # Even though we only need 'uid', `select_related('asset__uid')`
        # actually pulled in the entire `kpi_asset` table under Django 1.8. In
        # Django 1.9, "select_related() prohibits non-relational fields for
        # nested relations."
        queryset = queryset.select_related('asset')
        return queryset
