from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiRequest, \
    OpenApiExample, OpenApiParameter
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin
from rest_framework import serializers

from kpi.permissions import AttachmentDeletionPermission
from kpi.schema_extensions.v2.asset_attachments.serializers import AssetAttachmentBulkRequest
from kpi.serializers.v2.attachment_delete import AttachmentDeleteSerializer
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import open_api_204_empty_response, \
     open_api_202_accepted_response
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin

@extend_schema(
    tags=['Attachments']
)
@extend_schema_view(
    # Due to limitations in drf-spectacular support of OAS 3.1, DELETE actions
    # cannot yet show and generate a request body or response body. Will need
    # to keep updated when more support will come out.
    bulk=extend_schema(
        description=read_md('kpi', 'asset_attachments/bulk.md'),
        request={'application/json': AssetAttachmentBulkRequest},
        responses=open_api_202_accepted_response(
            media_type='application/json',
            raise_access_forbidden=False,
            require_auth=False,
        ),
    ),
    destroy=extend_schema(
        description=read_md('kpi', 'asset_attachments/delete.md'),
        responses=open_api_204_empty_response(
            media_type='application/json',
            raise_access_forbidden=False,
            require_auth=False,
        )
    ),
)
class AttachmentDeleteViewSet(
    NestedViewSetMixin, AssetNestedObjectViewsetMixin, viewsets.ViewSet
):
    """
    ViewSet for managing the current user's asset attachment

    Available actions:
    - delete      → DELETE /api/v2/assets/{uid}/attachments/{id}/
    - bulk        → DELETE /api/v2/assets/{uid}/attachments/bulk/

    Documentation:
    - docs/api/v2/asset_attachments/bulk.md
    - docs/api/v2/asset_attachments/delete.md
    """
    # FIXME: Future refactoring is needed for permissions in openrosa_backend.py to
    # avoid checking validating partial permissions in both the permission class
    # here and in the backend
    renderer_classes = [JSONRenderer]
    permission_classes = [AttachmentDeletionPermission]
    http_method_names = ['delete']
    lookup_field = 'uid'

    def _perform_attachment_deletion(self, request, data, success_status):
        serializer = AttachmentDeleteSerializer(
            data=data,
            context={'asset': self.asset, 'request': request},
        )
        serializer.is_valid(raise_exception=True)
        result = serializer.save(request=request, asset=self.asset)
        return Response(result, status=success_status)

    @action(detail=False, methods=['DELETE'])
    def bulk(self, request, *args, **kwargs):
        return self._perform_attachment_deletion(
            request, request.data, status.HTTP_202_ACCEPTED
        )

    def destroy(self, request, pk=None, *args, **kwargs):
        data = {'attachment_uid': pk}
        return self._perform_attachment_deletion(
            request, data, status.HTTP_204_NO_CONTENT
        )
