# coding: utf-8
import copy

import requests
from django.http import HttpResponseRedirect
from django.conf import settings
from rest_framework import renderers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.reverse import reverse

from kpi.filters import RelatedAssetPermissionsFilter
from kpi.highlighters import highlight_xform
from kpi.models import AssetSnapshot, AssetFile, PairedData
from kpi.renderers import (
    OpenRosaFormListRenderer,
    OpenRosaManifestRenderer,
    XMLRenderer,
)
from kpi.serializers.v2.asset_snapshot import AssetSnapshotSerializer
from kpi.serializers.v2.open_rosa import FormListSerializer, ManifestSerializer
from kpi.views.no_update_model import NoUpdateModelViewSet
from kpi.views.v2.open_rosa import OpenRosaViewSetMixin


class AssetSnapshotViewSet(OpenRosaViewSetMixin, NoUpdateModelViewSet):

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

    @action(detail=True,
            renderer_classes=[OpenRosaFormListRenderer],
            url_path='formList')
    def form_list(self, request, *args, **kwargs):
        """
        This route is used by enketo when it fetches external resources.
        It let us specify manifests for preview
        """
        snapshot = self.get_object()
        context = {'request': request}
        serializer = FormListSerializer([snapshot], many=True, context=context)

        return Response(serializer.data, headers=self.get_headers())

    @action(detail=True, renderer_classes=[OpenRosaManifestRenderer])
    def manifest(self, request, *args, **kwargs):
        """
        This route is used by enketo when it fetches external resources.
        It returns form media files location in order to display them within
        enketo preview
        """
        snapshot = self.get_object()
        asset = snapshot.asset
        form_media_files = list(
            asset.asset_files.filter(
                file_type=AssetFile.FORM_MEDIA,
                date_deleted__isnull=True,
            )
        )
        files = form_media_files
        # paired data files are treated differently from form media files
        # void any cache when previewing the form
        for paired_data in PairedData.objects(asset).values():
            paired_data.void_external_xml_cache()
            files.append(paired_data)

        context = {'request': request}
        serializer = ManifestSerializer(files, many=True, context=context)

        return Response(serializer.data, headers=self.get_headers())

    @action(detail=True, renderer_classes=[renderers.TemplateHTMLRenderer])
    def preview(self, request, *args, **kwargs):
        snapshot = self.get_object()
        if snapshot.details.get('status') == 'success':
            data = {
                'server_url': reverse(viewname='assetsnapshot-detail',
                                      kwargs={'uid': snapshot.uid},
                                      request=request
                                      ),
                'form_id': snapshot.uid
            }

            # Use Enketo API to create preview instead of `preview?form=`,
            # which does not load any form media files.
            response = requests.post(
                f'{settings.ENKETO_SERVER}'
                f'{settings.ENKETO_PREVIEW_ENDPOINT}',
                # bare tuple implies basic auth
                auth=(settings.ENKETO_API_TOKEN, ''),
                data=data
            )
            response.raise_for_status()

            json_response = response.json()
            preview_url = json_response.get('preview_url')
            
            return HttpResponseRedirect(preview_url)
        else:
            response_data = copy.copy(snapshot.details)
            return Response(response_data, template_name='preview_error.html')

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
