# coding: utf-8
from typing import Optional, Union

from django.conf import settings
from django.shortcuts import Http404
from django.utils.translation import gettext as t
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kobo.apps.superuser_stats.views import retrieve_reports
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
from kpi.views.docs.asset_attachments.asset_attachment_docs import (
    asset_attachment_list,
    asset_attachment_retrieve,
    asset_attachment_thumb,
)

thumbnail_suffixes_pattern = 'original|' + '|'.join(
    [suffix for suffix in settings.THUMB_CONF]
)


@extend_schema(
    tags=['Attachments'],
)
@extend_schema_view(
    list=extend_schema(
      description=asset_attachment_list
    ),
    retrieve=extend_schema(
        description=asset_attachment_retrieve,
    ),
    thumb=extend_schema(
        description=asset_attachment_thumb,
    ),
)
class AttachmentViewSet(
    NestedViewSetMixin,
    AssetNestedObjectViewsetMixin,
    viewsets.ViewSet
):
    renderer_classes = (
        MediaFileRenderer,
        MP3ConversionRenderer,
    )
    permission_classes = (SubmissionPermission,)

    def retrieve(self, request, pk, *args, **kwargs):
        # Since endpoint is needed for KobocatDeploymentBackend to overwrite
        # Mongo attachments URL with their primary keys or uid (instead of their XPath)
        submission_id_or_uuid = kwargs['parent_lookup_data']
        return self._get_response(
            request,
            submission_id_or_uuid,
            attachment_id_or_uid=pk,
            suffix=kwargs.get('suffix'),
        )

    @action(
        detail=True,
        methods=['GET'],
        url_path=f'(?P<suffix>({thumbnail_suffixes_pattern}))'
    )
    def thumb(self, request, pk, suffix, *args, **kwargs):
        if suffix != 'original':
            kwargs['suffix'] = suffix
        return self.retrieve(request, pk, *args, **kwargs)

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
        attachment_id_or_uid: Optional[Union[str, int]] = None,
        xpath: Optional[str] = None,
        suffix: Optional[str] = None,
    ) -> Response:

        try:
            attachment = self.asset.deployment.get_attachment(
                submission_id_or_uuid, request.user, attachment_id_or_uid, xpath
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
                format_=request.accepted_renderer.format,
                suffix=suffix,
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
            # specify the content type for the response.
            content_type = (
                attachment.mimetype
                if request.accepted_renderer.format != MP3ConversionRenderer.format
                else None
            )
            return Response(
                attachment.media_file,
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
