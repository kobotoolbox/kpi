from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.permissions import AttachmentDeletionPermission
from kpi.serializers.v2.attachment_bulk_delete import AttachmentBulkDeleteSerializer
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin


class AttachmentBulkDeleteViewSet(
    NestedViewSetMixin, AssetNestedObjectViewsetMixin, viewsets.ViewSet
):
    permission_classes = [AttachmentDeletionPermission]

    @action(detail=False, methods=['DELETE'])
    def bulk(self, request, *args, **kwargs):
        """
        ## DELETE specific attachments of an Asset

        <pre class="prettyprint">
        <b>DELETE</b>  /api/v2/assets/<code>{asset_uid}</code>/attachments/bulk/
        </pre>

        > Example
        >
        >       curl -X DELETE https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/attachments/bulk/ # noqa

        > **Payload**
        >
        >        {
        >           "attachment_uids": [
        >               "attYAsK3XHh4Mv5JJ69k72kq",
        >               "attVvwvLqzLPfdHtqgstPTCJ"
        >           ]
        >        }

        where:

        * "attachment_uids" (required) is a list of the attachments on the asset
          to delete
        """

        serializer = AttachmentBulkDeleteSerializer(
            data=request.data, context={'request': request, 'asset': self.asset}
        )
        serializer.is_valid(raise_exception=True)

        result = serializer.save(request=request, asset=self.asset)

        return Response(result, status=status.HTTP_202_ACCEPTED)
