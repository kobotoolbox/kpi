# coding: utf-8
from datetime import datetime
try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo

from django.conf import settings
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action

from kobo.apps.openrosa.apps.api.tools import get_media_file_response
from kobo.apps.openrosa.apps.logger.models.xform import XForm
from kobo.apps.openrosa.apps.main.models.meta_data import MetaData
from kobo.apps.openrosa.libs import filters
from kobo.apps.openrosa.libs.authentication import DigestAuthentication
from kobo.apps.openrosa.libs.renderers.renderers import MediaFileContentNegotiation
from kobo.apps.openrosa.libs.renderers.renderers import XFormListRenderer
from kobo.apps.openrosa.libs.renderers.renderers import XFormManifestRenderer
from kobo.apps.openrosa.libs.serializers.xform_serializer import XFormListSerializer
from kobo.apps.openrosa.libs.serializers.xform_serializer import XFormManifestSerializer
from ..utils.rest_framework.viewsets import OpenRosaReadOnlyModelViewSet


class XFormListApi(OpenRosaReadOnlyModelViewSet):

    content_negotiation_class = MediaFileContentNegotiation
    filter_backends = (filters.XFormListObjectPermissionFilter,)
    queryset = XForm.objects.filter(downloadable=True)
    permission_classes = (permissions.AllowAny,)
    renderer_classes = (XFormListRenderer,)
    serializer_class = XFormListSerializer
    template_name = 'api/xformsList.xml'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Respect DEFAULT_AUTHENTICATION_CLASSES, but also ensure that the
        # previously hard-coded authentication classes are included first
        authentication_classes = [
            DigestAuthentication,
        ]
        self.authentication_classes = authentication_classes + [
            auth_class
            for auth_class in self.authentication_classes
            if auth_class not in authentication_classes
        ]

    def get_openrosa_headers(self):
        dt = datetime.now(tz=ZoneInfo('UTC')).strftime('%a, %d %b %Y %H:%M:%S %Z')

        return {
            'Date': dt,
            'X-OpenRosa-Version': '1.0',
            'X-OpenRosa-Accept-Content-Length': settings.OPENROSA_DEFAULT_CONTENT_LENGTH,
            'Content-Type': 'text/xml; charset=utf-8',
        }

    def get_response_for_head_request(self):
        # Copied from
        # https://github.com/kobotoolbox/kpi/commit/cabcaaa664159320ba281fd588423423a17f5b82
        # See further discussion there
        return Response(
            headers=self.get_openrosa_headers(), status=status.HTTP_204_NO_CONTENT
        )

    def get_renderers(self):
        if self.action and self.action == 'manifest':
            return [XFormManifestRenderer()]

        return super().get_renderers()

    def filter_queryset(self, queryset):
        username = self.kwargs.get('username')

        if username is None:
            # If no username is specified, the request must be authenticated
            if self.request.user.is_anonymous:
                # raises a permission denied exception, forces authentication
                self.permission_denied(self.request)
            else:
                # Return all the forms the currently-logged-in user can access,
                # including those shared by other users
                queryset = super().filter_queryset(queryset)
        else:
            # Only return projects that allow anonymous submissions when path
            # starts with a username
            queryset = queryset.filter(
                user__username=username.lower(), require_auth=False
            )

        try:
            # https://docs.getodk.org/openrosa-form-list/#form-list-api says:
            #   `formID`: If specified, the server MUST return information for
            #   only this formID.
            id_string_filter = self.request.GET['formID']
        except KeyError:
            pass
        else:
            queryset = queryset.filter(id_string=id_string_filter)

        return queryset

    def list(self, request, *args, **kwargs):

        object_list = self.filter_queryset(self.get_queryset())

        if request.method == 'HEAD':
            return self.get_response_for_head_request()

        serializer = self.get_serializer(
            object_list, many=True, require_auth=not bool(kwargs.get('username'))
        )
        return Response(serializer.data, headers=self.get_openrosa_headers())

    def retrieve(self, request, *args, **kwargs):
        xform = self.get_object()

        return Response(
            xform.xml_with_disclaimer, headers=self.get_openrosa_headers()
        )

    @action(detail=True, methods=['GET'])
    def manifest(self, request, *args, **kwargs):
        xform = self.get_object()
        media_files = {}
        expired_objects = False

        if request.method == 'HEAD':
            return self.get_response_for_head_request()

        # Retrieve all media files for the current form
        queryset = MetaData.objects.filter(
            data_type__in=MetaData.MEDIA_FILES_TYPE, xform=xform
        )
        object_list = queryset.all()

        # Keep only media files that are not considered as expired.
        # Expired files may have an out-of-date hash which needs to be refreshed
        # before being exposed to the serializer
        for obj in object_list:
            if not obj.has_expired:
                media_files[obj.pk] = obj
                continue
            expired_objects = True

        # Retrieve all media files for the current form again except non
        # expired ones. The expired objects should have an up-to-date hash now.
        if expired_objects:
            refreshed_object_list = queryset.exclude(pk__in=media_files.keys())
            for refreshed_object in refreshed_object_list.all():
                media_files[refreshed_object.pk] = refreshed_object

        # Sort objects all the time because EE calculates a hash of the
        # whole manifest to detect any changes the next time EE downloads it.
        # If no files changed, but the order did, the hash of the manifest
        # would be different and EE would display:
        # > "A new version of this form has been downloaded"
        media_files = dict(sorted(media_files.items()))
        context = self.get_serializer_context()
        serializer = XFormManifestSerializer(
            media_files.values(),
            many=True,
            context=context,
            require_auth=not bool(kwargs.get('username')),
        )

        return Response(serializer.data, headers=self.get_openrosa_headers())

    @action(detail=True, methods=['GET'])
    def media(self, request, *args, **kwargs):
        xform = self.get_object()
        pk = kwargs.get('metadata')

        if not pk:
            raise Http404()

        meta_obj = get_object_or_404(
            MetaData,
            data_type__in=MetaData.MEDIA_FILES_TYPE,
            xform=xform,
            pk=pk,
        )

        if request.method == 'HEAD':
            return self.get_response_for_head_request()

        return get_media_file_response(meta_obj, request)
