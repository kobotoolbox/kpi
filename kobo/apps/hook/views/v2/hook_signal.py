# coding: utf-8
from django.http import Http404
from django.utils.translation import ugettext_lazy as _
from rest_framework import status, viewsets, serializers
from rest_framework.response import Response
from rest_framework.pagination import _positive_int as positive_int
from rest_framework_extensions.mixins import NestedViewSetMixin


from kobo.apps.hook.utils import HookUtils
from kpi.models import Asset
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


class HookSignalViewSet(AssetNestedObjectViewsetMixin, NestedViewSetMixin,
                        viewsets.ViewSet):
    """
    ##
    This endpoint is only used to trigger asset's hooks if any.

    Tells the hooks to post an instance to external servers.
    <pre class="prettyprint">
    <b>POST</b> /api/v2/assets/<code>{uid}</code>/hook-signal/
    </pre>


    > Example
    >
    >       curl -X POST https://[kpi-url]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/hook-signal/


    > **Expected payload**
    >
    >        {
    >           "instance_id": {integer}
    >        }

    """

    parent_model = Asset

    def create(self, request, *args, **kwargs):
        """
        It's only used to trigger hook services of the Asset (so far).

        :param request:
        :return:
        """
        try:
            instance_id = positive_int(
                request.data.get('instance_id'), strict=True)
        except ValueError:
            raise serializers.ValidationError(
                {'instance_id': _('A positive integer is required.')})

        # Check if instance really belongs to Asset.
        try:
            instance = self.asset.deployment.get_submission(instance_id,
                                                            request.user.id)
        except ValueError:
            raise Http404

        instance_id_fieldname = self.asset.deployment.INSTANCE_ID_FIELDNAME
        if not (instance and
                int(instance.get(instance_id_fieldname)) == instance_id):
            raise Http404

        if HookUtils.call_services(self.asset, instance_id):
            # Follow Open Rosa responses by default
            response_status_code = status.HTTP_202_ACCEPTED
            response = {
                "detail": _(
                    "We got and saved your data, but may not have "
                    "fully processed it. You should not try to resubmit.")
            }
        else:
            # call_services() refused to launch any task because this
            # instance already has a `HookLog`
            response_status_code = status.HTTP_409_CONFLICT
            response = {
                "detail": _(
                    "Your data for instance {} has been already "
                    "submitted.".format(instance_id))
            }

        return Response(response, status=response_status_code)
