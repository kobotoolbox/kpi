# coding: utf-8
import subprocess
from typing import Optional

from django.shortcuts import Http404
from django.utils.translation import gettext as t
from rest_framework import viewsets, serializers
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.deployment_backends.kc_access.shadow_models import (
    ReadOnlyKobocatAttachment,
)
from kpi.exceptions import (
    AttachmentNotFoundException,
    InvalidXPathException,
    SubmissionNotFoundException,
    XPathNotFoundException,
)
from kpi.permissions import SubmissionPermission
from kpi.renderers import MediaFileRenderer, MP3ConversionRenderer
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin
from kpi.utils.log import logging

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

    SUPPORTED_CONVERTED_FORMAT = (
        'audio',
        'video',
    )

    def retrieve(self, request, pk, *args, **kwargs):
        # Since endpoint is needed for KobocatDeploymentBackend to overwrite
        # Mongo attachments URL with their primary keys (instead of their XPath)
        submission_id = kwargs['parent_lookup_data']
        return self._get_response(request, submission_id, attachment_id=pk)

    def list(self, request, *args, **kwargs):
        submission_id = kwargs['parent_lookup_data']
        try:
            xpath = request.query_params['xpath']
        except KeyError:
            raise serializers.ValidationError({
                'detail': t('`xpath` query parameter is required')
            }, 'xpath_missing')

        return self._get_response(request, submission_id, xpath=xpath)

    def _get_response(
        self,
        request,
        submission_id: int,
        attachment_id: Optional[int] = None,
        xpath: Optional[str] = None,
    ) -> Response:

        try:
            attachment = self.asset.deployment.get_attachment(
                submission_id, request.user, attachment_id, xpath
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

        if request.accepted_renderer.format == MP3ConversionRenderer.format:
            # setting the content type to `None` here allows the renderer to
            # specify the content type for the response
            content_type = None
            content = self._get_mp3(attachment)
            filename = attachment.media_file_basename
        else:
            content_type = attachment.mimetype
            content = attachment.media_file.read()
            filename = attachment.media_file_basename
            attachment.media_file.close()

        # Send filename to browser
        headers = {
            'Content-Disposition': f'inline; filename={filename}'
        }
        # Not optimized for big files.
        # ToDo Serve files with NGINX  `X-Accel-Redirect` option
        return Response(
            content,
            content_type=content_type,
            headers=headers,
        )

    def _get_mp3(self, attachment: ReadOnlyKobocatAttachment) -> str:
        if not attachment.mimetype.startswith(self.SUPPORTED_CONVERTED_FORMAT):
            raise serializers.ValidationError({
                'detail': t('Conversion is not supported for {}').format(
                    attachment.mimetype
                )
            }, 'not_supported_format')

        ffmpeg_command = [
            '/usr/bin/ffmpeg',
            '-i',
            attachment.media_file.path,
            '-f',
            MP3ConversionRenderer.format,
            'pipe:1',
        ]

        pipe = subprocess.run(
            ffmpeg_command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        if pipe.returncode:
            logging.error(f'ffmpeg error: {pipe.stderr}')
            raise serializers.ValidationError({
                'detail': t('Could not convert attachment')
            })

        # ToDo save output to avoid converting it again
        return pipe.stdout
