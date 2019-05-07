# -*- coding: utf-8 -*-
from __future__ import unicode_literals, absolute_import

from django.shortcuts import get_object_or_404
from django.utils.translation import ugettext_lazy as _
from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kobo.apps.hook.utils import HookUtils
from kpi.models import Asset
from kpi.utils.log import logging


class HookSignalViewSet(NestedViewSetMixin, viewsets.ViewSet):
    """
    ##
    This endpoint is only used to trigger asset's hooks if any.

    Tells the hooks to post an instance to external servers.
    <pre class="prettyprint">
    <b>POST</b> /assets/<code>{uid}</code>/hook-signal/
    </pre>


    > Example
    >
    >       curl -X POST https://[kpi-url]/assets/aSAvYreNzVEkrWg5Gdcvg/hook-signal/


    > **Expected payload**
    >
    >        {
    >           "instance_id": {integer}
    >        }

    """

    URL_NAMESPACE = 'api_v2'

    parent_model = Asset

    def create(self, request, *args, **kwargs):
        """
        It's only used to trigger hook services of the Asset (so far).

        :param request:
        :return:
        """
        # Follow Open Rosa responses by default
        response_status_code = status.HTTP_202_ACCEPTED
        response = {
            "detail": _(
                "We got and saved your data, but may not have fully processed it. You should not try to resubmit.")
        }
        try:
            asset_uid = self.get_parents_query_dict().get("asset")
            asset = get_object_or_404(self.parent_model, uid=asset_uid)
            instance_id = request.data.get("instance_id")
            instance = asset.deployment.get_submission(instance_id)

            # Check if instance really belongs to Asset.
            if not (instance and instance.get(asset.deployment.INSTANCE_ID_FIELDNAME) == instance_id):
                response_status_code = status.HTTP_404_NOT_FOUND
                response = {
                    "detail": _("Resource not found")
                }

            elif not HookUtils.call_services(asset, instance_id):
                response_status_code = status.HTTP_409_CONFLICT
                response = {
                    "detail": _(
                        "Your data for instance {} has been already submitted.".format(instance_id))
                }

        except Exception as e:
            logging.error("HookSignalViewSet.create - {}".format(str(e)))
            response = {
                "detail": _("An error has occurred when calling the external service. Please retry later.")
            }
            response_status_code = status.HTTP_500_INTERNAL_SERVER_ERROR

        return Response(response, status=response_status_code)
