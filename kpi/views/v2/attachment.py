# coding: utf-8
from typing import Optional, Union

from django.conf import settings
from django.http import Http404, HttpResponseRedirect
from django.utils.translation import gettext as t
from django.utils.translation import ugettext_lazy as _
from rest_framework import serializers
from rest_framework import viewsets, renderers
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.deployment_backends.kc_access.shadow_models import (
    ReadOnlyKobocatAttachment,
)
from kpi.exceptions import (
    AttachmentNotFoundException,
    FFMpegException,
    InvalidXPathException,
    NotSupportedFormatException,
    SubmissionNotFoundException,
    XPathNotFoundException,
)
from kpi.filters import AttachmentFilter
from kpi.permissions import SubmissionPermission
from kpi.renderers import MP3ConversionRenderer
from kpi.renderers import MediaFileRenderer
from kpi.serializers.v2.gallery import (
    AttachmentSerializer,
    AttachmentListSerializer,
    AttachmentPagination,
    QuestionSerializer,
    QuestionPagination,
    SubmissionSerializer,
    SubmissionPagination,
)
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


class GalleryAttachmentViewSet(
    AssetNestedObjectViewsetMixin,
    NestedViewSetMixin,
    viewsets.ReadOnlyModelViewSet,
):
    lookup_field = 'pk'
    serializer_class = AttachmentSerializer
    filter_backends = (AttachmentFilter,)
    renderer_classes = (
        renderers.JSONRenderer,
        renderers.BrowsableAPIRenderer,
        MediaFileRenderer,
    )

    def _group_by(self):
        if not self.request:
            return None
        return self.request.query_params.get('group_by')

    def get_serializer_class(self):
        if self.action == 'list':
            if self._group_by() == 'question':
                return QuestionSerializer
            if self._group_by() == 'submission':
                return SubmissionSerializer
            return AttachmentListSerializer
        else:
            return AttachmentSerializer

    def get_serializer_context(self):
        return {
            'request': self.request,
            'asset': self.asset,
            'asset_uid': self.asset_uid,
            'group_by': self._group_by(),
        }

    def get_queryset(self):
        if not self.asset.has_deployment:
            raise Http404
        xform_id_string = self.asset.deployment.xform_id_string
        return ReadOnlyKobocatAttachment.objects.filter(
            instance__xform__id_string=xform_id_string
        )

    def get_paginator(self):
        if self._group_by() and self._group_by() == 'question':
            paginator = QuestionPagination()
        elif self._group_by() and self._group_by() == 'submission':
            paginator = SubmissionPagination()
        else:
            paginator = AttachmentPagination()
        return paginator

    def retrieve(self, request, *args, **kwargs):
        self.object = self.get_object()
        serializer = self.get_serializer(self.object)

        if hasattr(request, 'accepted_renderer'):
            if (
                isinstance(request.accepted_renderer, MediaFileRenderer)
                and self.object.media_file is not None
            ):
                data = self.object.media_file.read()

                return Response(data, content_type=self.object.mimetype)

        filename = request.query_params.get('filename')
        if filename:
            source = None
            if (
                filename == self.object.media_file.name
                or filename == self.object.filename
            ):
                size = request.query_params.get('size')
                if size == 'small':
                    source = serializer.get_small_download_url(self.object)
                elif size == 'medium':
                    source = serializer.get_medium_download_url(self.object)
                elif size == 'large':
                    source = serializer.get_large_download_url(self.object)
                else:
                    source = serializer.get_download_url(self.object)
            if source:
                return HttpResponseRedirect(source)
            else:
                raise Http404(_("Filename '%s' not found." % filename))

        return Response(serializer.data)


class AttachmentViewSet(
    NestedViewSetMixin,
    AssetNestedObjectViewsetMixin,
    viewsets.ViewSet
):
    """
        ## GET an audio or video file

        <pre class="prettyprint">
        <b>GET</b>  /api/v2/assets/<code>{asset_uid}</code>/data/<code>{data_id}</code>/attachment/?xpath=<code>{xml_path_to_question}</code>
        </pre>

        <sup>*</sup>`data_id` can be the primary key of the submission or its `uuid`.
        Please note that using the `uuid` may match **several** submissions, only
        the first match will be returned.

        > Example
        >
        >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/451/attachment/?xpath=Upload_a_file

        ## GET an MP3 file from an audio or video file
        Convert audio and video files. Only conversions to MP3 is supported for this feature

        <pre class="prettyprint">
        <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/data/<code>{data_id}</code>/attachment/?xpath=<code>{xml_path_to_question}</code>&format=mp3
        </pre>

        > Example
        >
        >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/451/attachment/?xpath=Upload_a_file&format=mp3
    """
    renderer_classes = (
        MediaFileRenderer,
        MP3ConversionRenderer,
    )
    permission_classes = (SubmissionPermission,)

    def retrieve(self, request, pk, *args, **kwargs):
        # Since endpoint is needed for KobocatDeploymentBackend to overwrite
        # Mongo attachments URL with their primary keys (instead of their XPath)
        submission_id_or_uuid = kwargs['parent_lookup_data']
        return self._get_response(request, submission_id_or_uuid, attachment_id=pk)

    def list(self, request, *args, **kwargs):
        submission_id_or_uuid = kwargs['parent_lookup_data']
        try:
            xpath = request.query_params['xpath']
        except KeyError:
            raise serializers.ValidationError({
                'detail': t('`xpath` query parameter is required')
            }, 'xpath_missing')

        return self._get_response(request, submission_id_or_uuid, xpath=xpath)

    def _get_response(
        self,
        request,
        submission_id_or_uuid: Union[str, int],
        attachment_id: Optional[int] = None,
        xpath: Optional[str] = None,
    ) -> Response:

        try:
            attachment = self.asset.deployment.get_attachment(
                submission_id_or_uuid, request.user, attachment_id, xpath
            )
        except (SubmissionNotFoundException, AttachmentNotFoundException):
            raise Http404
        except InvalidXPathException:
            raise serializers.ValidationError({
                'detail': t('Invalid XPath syntax')
            }, 'invalid_xpath')
        except XPathNotFoundException:
            raise serializers.ValidationError({
                'detail': t('The path could not be found in the submission')
            }, 'xpath_not_found')

        try:
            protected_path = attachment.protected_path(
                request.accepted_renderer.format
            )
        except FFMpegException:
            raise serializers.ValidationError({
                'detail': t('The error occurred during conversion')
            }, 'ffmpeg_error')
        except NotSupportedFormatException:
            raise serializers.ValidationError({
                'detail': t('Conversion is not supported for {}').format(
                    attachment.mimetype
                )
            }, 'not_supported_format')

        # If unit tests are running, pytest webserver does not support
        # `X-Accel-Redirect` header (or ignores it?). We need to pass
        # the content to the Response object
        if settings.TESTING:
            # setting the content type to `None` here allows the renderer to
            # specify the content type for the response
            content_type = (
                attachment.mimetype
                if request.accepted_renderer.format != MP3ConversionRenderer.format
                else None
            )
            return Response(
                attachment.content,
                content_type=content_type,
            )

        # Otherwise, let NGINX determine the correct content type and serve
        # the file
        headers = {
            'Content-Disposition': f'inline; filename={attachment.media_file_basename}',
            'X-Accel-Redirect': protected_path
        }
        response = Response(content_type='', headers=headers)
        return response
