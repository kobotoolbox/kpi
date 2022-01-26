from django.utils.translation import gettext as t
from rest_framework import viewsets, serializers
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.models.asset import Asset
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

    def list(self, request, *args, **kwargs):

        submission_id = kwargs['parent_lookup_data']
        filters = request.query_params.dict()
        try:
            xpath = filters['xpath']
        except KeyError:
            raise serializers.ValidationError({
                'xpath': t('Please query the path to the file')
            })

        filename, content, content_type = self.asset.deployment.get_attachment_content(
            submission_id,
            request.user,
            xpath
        )

        if request.accepted_renderer.format == MP3ConversionRenderer.format:
            if not content_type.startswith(self.SUPPORTED_CONVERTED_FORMAT):
                raise serializers.ValidationError({
                    'format': t('Conversion is not supported for {}'.format(
                        content_type
                    ))
                })
            set_content = None
        else:
            set_content = content_type

        # Send filename to browser
        headers = {
            'Content-Disposition': f'inline; filename={filename}'
        }

        return Response(
            content,
            content_type=set_content,
            headers=headers,
        )
