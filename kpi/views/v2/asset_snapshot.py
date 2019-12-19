# coding: utf-8
import copy

from django.http import HttpResponseRedirect
from django.conf import settings
from rest_framework import renderers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.reverse import reverse

from kpi.filters import RelatedAssetPermissionsFilter
from kpi.highlighters import highlight_xform
from kpi.models import AssetSnapshot
from kpi.renderers import XMLRenderer
from kpi.serializers.v2.asset_snapshot import AssetSnapshotSerializer
from kpi.views.no_update_model import NoUpdateModelViewSet


class AssetSnapshotViewSet(NoUpdateModelViewSet):

    """
    <span class='label label-danger'>TODO Documentation for this endpoint</span>

    ### CURRENT ENDPOINT
    """

    serializer_class = AssetSnapshotSerializer
    lookup_field = 'uid'
    queryset = AssetSnapshot.objects.all()

    renderer_classes = NoUpdateModelViewSet.renderer_classes + [
        XMLRenderer,
    ]

    def filter_queryset(self, queryset):
        if (self.action == 'retrieve' and
                self.request.accepted_renderer.format == 'xml'):
            # The XML renderer is totally public and serves anyone, so
            # /asset_snapshot/valid_uid.xml is world-readable, even though
            # /asset_snapshot/valid_uid/ requires ownership. Return the
            # queryset unfiltered
            return queryset
        else:
            user = self.request.user
            owned_snapshots = queryset.none()
            if not user.is_anonymous:
                owned_snapshots = queryset.filter(owner=user)
            return owned_snapshots | RelatedAssetPermissionsFilter(
                ).filter_queryset(self.request, queryset, view=self)

    @action(detail=True, renderer_classes=[renderers.TemplateHTMLRenderer])
    def xform(self, request, *args, **kwargs):
        """
        This route will render the XForm into syntax-highlighted HTML.
        It is useful for debugging pyxform transformations
        """
        snapshot = self.get_object()
        response_data = copy.copy(snapshot.details)
        options = {
            'linenos': True,
            'full': True,
        }
        if snapshot.xml != '':
            response_data['highlighted_xform'] = highlight_xform(snapshot.xml,
                                                                 **options)
        return Response(response_data, template_name='highlighted_xform.html')

    @action(detail=True, renderer_classes=[renderers.TemplateHTMLRenderer])
    def preview(self, request, *args, **kwargs):
        snapshot = self.get_object()
        if snapshot.details.get('status') == 'success':
            preview_url = "{}{}?form={}".format(
                              settings.ENKETO_SERVER,
                              settings.ENKETO_PREVIEW_URI,
                              reverse(viewname='assetsnapshot-detail',
                                      format='xml',
                                      kwargs={'uid': snapshot.uid},
                                      request=request
                                      ),
                            )

            return HttpResponseRedirect(preview_url)
        else:
            response_data = copy.copy(snapshot.details)
            return Response(response_data, template_name='preview_error.html')
