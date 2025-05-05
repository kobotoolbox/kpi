from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.permissions import AttachmentDeletionPermission
from kpi.serializers.v2.attachment_delete import AttachmentDeleteSerializer
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


class AttachmentDeleteViewSet(
    NestedViewSetMixin, AssetNestedObjectViewsetMixin, viewsets.ViewSet
):
    # FIXME: Future refactoring is needed for permissions in openrosa_backend.py to
    # avoid checking validating partial permissions in both the permission class
    # here and in the backend
    permission_classes = [AttachmentDeletionPermission]

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
        """
        ## DELETE all attachments from a list of submissions

        <pre class="prettyprint">
        <b>DELETE</b>  /api/v2/assets/<code>{asset_uid}</code>/attachments/bulk/
        </pre>

        > Example
        >
        >       curl -X DELETE https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/attachments/bulk/ # noqa

        > **Payload**
        >
        >        {
        >           "submission_root_uuids": [
        >               "3ed2e8de-b493-4367-a78d-3463687239dc",
        >               "ef18fe33-c71d-4638-84d6-dafcbd69c327"
        >           ]
        >        }

        where:

        * "submission_root_uuids" (required) is a list of submission root uuids on the asset
          to delete
        """
        return self._perform_attachment_deletion(
            request, request.data, status.HTTP_202_ACCEPTED
        )

    def destroy(self, request, pk=None, *args, **kwargs):
        """
        ## DELETE a specific attachment of an Asset

        <pre class="prettyprint">
        <b>DELETE</b>  /api/v2/assets/<code>{asset_uid}</code>/attachments/<code>{attachment_uid}</code>/  # noqa
        </pre>
        """

        data = {'attachment_uid': pk}
        return self._perform_attachment_deletion(
            request, data, status.HTTP_204_NO_CONTENT
        )
