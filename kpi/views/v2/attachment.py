# coding: utf-8
from typing import Optional, Union

from django.conf import settings
from django.shortcuts import Http404
from django.utils.translation import gettext as t
from rest_framework import viewsets, serializers
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.exceptions import (
    AttachmentNotFoundException,
    FFMpegException,
    InvalidXPathException,
    NotSupportedFormatException,
    SubmissionNotFoundException,
    XPathNotFoundException,
)
from kpi.permissions import SubmissionPermission
from kpi.renderers import MediaFileRenderer, MP3ConversionRenderer
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


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
