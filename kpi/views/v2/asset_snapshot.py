# coding: utf-8
import copy

import requests
from django.conf import settings
from django.http import HttpResponseRedirect, Http404
from rest_framework import renderers, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.reverse import reverse

from kpi.authentication import DigestAuthentication, EnketoSessionAuthentication
from kpi.constants import PERM_VIEW_ASSET
from kpi.exceptions import SubmissionIntegrityError
from kpi.filters import RelatedAssetPermissionsFilter
from kpi.highlighters import highlight_xform
from kpi.models import AssetSnapshot, AssetFile, PairedData
from kpi.permissions import EditSubmissionPermission
from kpi.renderers import (
    OpenRosaFormListRenderer,
    OpenRosaManifestRenderer,
    XMLRenderer,
)
from kpi.serializers.v2.asset_snapshot import AssetSnapshotSerializer
from kpi.serializers.v2.open_rosa import FormListSerializer, ManifestSerializer
from kpi.tasks import enketo_flush_cached_preview
from kpi.utils.object_permission import get_database_user
from kpi.utils.project_views import (
    user_has_project_view_asset_perm,
)
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

    @property
    def asset(self):
        if not hasattr(self, '_asset'):
            asset_snapshot = self.get_object()
            # Calling `snapshot.asset.__class__` instead of `Asset` to avoid circular
            # import
            asset_snapshot.asset = asset_snapshot.asset.__class__.objects.defer(
                'content'
            ).get(pk=asset_snapshot.asset_id)
            setattr(self, '_asset', asset_snapshot.asset)
        return self._asset

    def filter_queryset(self, queryset):
        if (
            self.action == 'submission'
            or (
                self.action == 'retrieve'
                and self.request.accepted_renderer.format == 'xml'
            )
        ):
            # The XML renderer is totally public and serves anyone, so
            # /asset_snapshot/valid_uid.xml is world-readable, even though
            # /asset_snapshot/valid_uid/ requires ownership. Return the
            # queryset unfiltered

            # If action is 'submission', we also need to return the queryset
            # unfiltered to avoid returning a 404 if user has not been authenticated
            # yet. The filtering will be handled by the `submission()` method itself.
            return queryset
        else:
            user = self.request.user
            owned_snapshots = queryset.none()
            if not user.is_anonymous:
                owned_snapshots = queryset.filter(owner=user)
            return owned_snapshots | RelatedAssetPermissionsFilter(
                ).filter_queryset(self.request, queryset, view=self)

    @action(
        detail=True,
        renderer_classes=[OpenRosaFormListRenderer],
        url_path='formList',
    )
    def form_list(self, request, *args, **kwargs):
        """
        Implements part of the OpenRosa Form List API.
        This route is used by Enketo when it fetches external resources.
        It let us specify manifests for preview
        """
        if request.method == 'HEAD':
            return self.get_response_for_head_request()

        snapshot = self.get_object()
        context = {'request': request}
        serializer = FormListSerializer([snapshot], many=True, context=context)

        return Response(serializer.data, headers=self.get_headers())

    def get_object(self):
        try:
            # Trivial case, try access the object with normal flow
            snapshot = super().get_object()
        except Http404 as e:
            # If 404, fall back on project view permissions
            try:
                snapshot = self.queryset.select_related('asset').defer(
                    'asset__content'
                ).get(uid=self.kwargs[self.lookup_field])
            except AssetSnapshot.DoesNotExist:
                raise e

            user = get_database_user(self.request.user)

            if (
                self.request.method == 'GET'
                and user_has_project_view_asset_perm(
                    snapshot.asset, user, PERM_VIEW_ASSET
                )
            ):
                return snapshot
            else:
                # Access to user is still denied, raise 404
                raise Http404
        else:
            return snapshot

    @action(
        detail=True,
        renderer_classes=[OpenRosaManifestRenderer],
    )
    def manifest(self, request, *args, **kwargs):
        """
        Implements part of the OpenRosa Form List API.
        This route is used by Enketo when it fetches external resources.
        It returns form media files location in order to display them within
        Enketo preview
        """
        if request.method == 'HEAD':
            return self.get_response_for_head_request()

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
        # **Not** part of the OpenRosa API
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
                f'{settings.ENKETO_URL}/{settings.ENKETO_PREVIEW_ENDPOINT}',
                # bare tuple implies basic auth
                auth=(settings.ENKETO_API_TOKEN, ''),
                data=data
            )
            response.raise_for_status()

            # Ask Celery to remove the preview from its XSLT cache after some
            # reasonable delay; see
            # https://github.com/enketo/enketo-express/issues/357
            enketo_flush_cached_preview.apply_async(
                kwargs=data,  # server_url and form_id
                countdown=settings.ENKETO_FLUSH_CACHED_PREVIEW_DELAY,
            )

            json_response = response.json()
            preview_url = json_response.get('preview_url')

            return HttpResponseRedirect(preview_url)
        else:
            response_data = copy.copy(snapshot.details)
            return Response(response_data, template_name='preview_error.html')

    @action(
        detail=True,
        permission_classes=[EditSubmissionPermission],
        methods=['HEAD', 'POST'],
        # Order of authentication classes is important (to return a 401 instead of 403).
        # See:
        # - https://github.com/encode/django-rest-framework/blob/df92e57ad6c8394ca54654dfc7a2722f822ed8c8/rest_framework/views.py#L183-L190
        # - https://github.com/encode/django-rest-framework/blob/df92e57ad6c8394ca54654dfc7a2722f822ed8c8/rest_framework/views.py#L455-L461
        authentication_classes=[
            DigestAuthentication,
            EnketoSessionAuthentication,
        ],
    )
    def submission(self, request, *args, **kwargs):
        """ Implements the OpenRosa Form Submission API """
        if request.method == 'HEAD':
            return self.get_response_for_head_request()

        asset_snapshot = self.get_object()

        xml_submission_file = request.data['xml_submission_file']

        # Prepare attachments even if all files are present in `request.FILES`
        # (i.e.: submission XML and attachments)
        attachments = None
        # Remove 'xml_submission_file' since it is already handled
        request.FILES.pop('xml_submission_file')
        if len(request.FILES):
            attachments = {}
            for name, attachment in request.FILES.items():
                attachments[name] = attachment

        try:
            xml_response = asset_snapshot.asset.deployment.edit_submission(
                xml_submission_file, request.user, attachments
            )
        except SubmissionIntegrityError as e:
            raise serializers.ValidationError(str(e))

        # Add OpenRosa headers to response
        xml_response['headers'].update(self.get_headers())
        return Response(**xml_response)

    @action(detail=True, renderer_classes=[renderers.TemplateHTMLRenderer])
    def xform(self, request, *args, **kwargs):
        """
        This route will render the XForm into syntax-highlighted HTML.
        It is useful for debugging pyxform transformations
        """
        # **Not** part of the OpenRosa API
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
