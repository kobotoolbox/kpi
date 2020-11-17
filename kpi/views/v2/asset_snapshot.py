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
from kpi.models import AssetSnapshot, AssetFile
from kpi.renderers import XMLRenderer, RawXMLRenderer
from kpi.serializers.v2.asset_snapshot import AssetSnapshotSerializer
from kpi.utils.hash import get_hash
from kpi.utils.log import logging
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

    @action(detail=True, renderer_classes=[RawXMLRenderer], url_path='formList')
    def form_list(self, request, *args, **kwargs):
        """
        This route is used by enketo when it fetches external resources.
        It let us specify manifests for preview
        """
        snapshot = self.get_object()
        md5_hash = get_hash(snapshot.xml)
        download_url = reverse(viewname='assetsnapshot-detail',
                               format='xml',
                               kwargs={'uid': snapshot.uid},
                               request=request
                               )
        manifest_url = reverse(viewname='assetsnapshot-manifest',
                               format='xml',
                               kwargs={'uid': snapshot.uid},
                               request=request
                               )
        return Response(
            '<?xml version="1.0" encoding="UTF-8" ?>'
            '<xforms xmlns="http://openrosa.org/xforms/xformsList">'
            '   <xform>'
            f'      <formID>{snapshot.uid}</formID>'
            f'      <name>{snapshot.asset.name}</name>'
            '       <majorMinorVersion/>'
            '       <version/>'
            f'       <hash>md5:{md5_hash}</hash>'
            f'       <descriptionText>{snapshot.asset.name}</descriptionText>'
            f'       <downloadUrl>{download_url}</downloadUrl>'
            f'       <manifestUrl>{manifest_url}</manifestUrl>'
            '   </xform>'
            '</xforms>')

    @action(detail=True, renderer_classes=[RawXMLRenderer])
    def manifest(self, request, *args, **kwargs):
        """
        This route is used by enketo when it fetches external resources.
        It returns form media files location in order to display them within
        enketo preview
        """
        snapshot = self.get_object()
        asset = snapshot.asset
        files = asset.asset_files.filter(file_type=AssetFile.FORM_MEDIA)

        xml_files = []
        for file in files:
            hash_ = file.metadata.get('hash')
            filename = file.metadata.get('filename')
            download_url = reverse('asset-file-content',
                                   args=(asset.uid, file.uid),
                                   request=request)
            xml_files.append(
                '<mediaFile>'
                f'   <filename>{filename}</filename>'
                f'   <hash>{hash_}</hash>'
                f'   <downloadUrl>{download_url}</downloadUrl>'
                '</mediaFile>'
            )
        return Response(
            '<?xml version="1.0" encoding="UTF-8" ?>'
            '<manifest xmlns="http://openrosa.org/xforms/xformsManifest">'
            f'{"".join(xml_files)}'
            '</manifest>')

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
            try:
                # Use Enketo API to create preview instead of `preview?form=`
                # because this way does not load external resources.
                response = requests.post(
                    f'{settings.ENKETO_SERVER}/'
                    f'{settings.ENKETO_PREVIEW_ENDPOINT}',
                    # bare tuple implies basic auth
                    auth=(settings.ENKETO_API_TOKEN, ''),
                    data=data
                )
                response.raise_for_status()
            except requests.exceptions.RequestException as e:
                # Don't 500 the entire asset view if Enketo is unreachable
                logging.error(
                    'Failed to retrieve preview link from Enketo',
                    exc_info=True
                )
                return {}

            try:
                json_response = response.json()
                preview_url = json_response.get('preview_url')
            except ValueError:
                return {}

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
