# coding: utf-8
from private_storage.views import PrivateStorageDetailView
from rest_framework import exceptions
from rest_framework.decorators import action
from rest_framework_extensions.mixins import NestedViewSetMixin

from kpi.constants import PERM_CHANGE_ASSET, PERM_VIEW_ASSET
from kpi.filters import RelatedAssetPermissionsFilter
from kpi.models import AssetFile
from kpi.serializers.v2.asset_file import AssetFileSerializer
from kpi.permissions import AssetNestedObjectPermission
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin
from kpi.views.no_update_model import NoUpdateModelViewSet


class AssetFileViewSet(AssetNestedObjectViewsetMixin, NestedViewSetMixin,
                       NoUpdateModelViewSet):
    """
    This endpoint shows uploaded files related to an asset.

    `uid` - is the unique identifier of a specific asset

    **Retrieve files**
    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{uid}</code>/files/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/files/

    Results can be narrowed down with a filter by type

    > Example
    >
    >       curl -X GET https://[kpi]/assets/aSAvYreNzVEkrWg5Gdcvg/files/?file_type=map_layer


    **Retrieve a file**
    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{uid}</code>/files/{file_uid}/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/files/afQoJxA4kmKEXVpkH6SYbhb/"


    **Create a new file**
    <pre class="prettyprint">
    <b>POST</b> /api/v2/assets/<code>{uid}</code>/files/
    </pre>

    > Example
    >
    >       curl -X POST https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/files/ \\
    >            -H 'Content-Type: application/json' \\
    >            -d '<payload>'  # Payload is sent as a string

    Fields:

    - `asset` (required)
    - `user` (required)
    - `description` (required)
    - `file_type`<sup>1</sup> (required)
    - `content` (as binary) <sup>2</sup> (required)
    - `metadata` JSON <sup>2</sup>

    <sup>1</sup> Files can have different types:

    - `map_layer`
    - `form_media`

    **Files with `form_media` type must have unique name per asset**

    <sup>2</sup> `content` can be sent as a base64 encoded string with `base64Encoded` parameter.
    `metadata` becomes mandatory and must contain `filename` property.


    > _Payload to create a file with binary content_
    >
    >        {
    >           "user": "https://[kpi]/api/v2/users/{username}/",
    >           "asset": "https://[kpi]/api/v2/asset/{asset_uid}/",
    >           "description": "Description of the file",
    >           "content": <binary>
    >        }

    > _Payload to create a file with base64 encoded content_
    >
    >        {
    >           "user": "https://[kpi]/api/v2/users/{username}/",
    >           "asset": "https://[kpi]/api/v2/asset/{asset_uid}/",
    >           "description": "Description of the file",
    >           "base64Encoded": "<base64-encoded-string>"
    >           "metadata": {"filename": "filename.ext"}
    >        }


    **Delete a file**

    <pre class="prettyprint">
    <b>DELETE</b> /api/v2/assets/<code>{uid}</code>/files/{file_uid}/
    </pre>

    > Example
    >
    >       curl -X DELETE https://[kpi]/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/files/pG6AeSjCwNtpWazQAX76Ap/

    ### CURRENT ENDPOINT
    """

    model = AssetFile
    lookup_field = 'uid'
    filter_backends = (RelatedAssetPermissionsFilter,)
    serializer_class = AssetFileSerializer
    permission_classes = (AssetNestedObjectPermission, )

    def get_queryset(self):
        _queryset = self.model.objects.filter(asset__uid=self.asset_uid)
        file_type = self.request.GET.get('file_type')
        if file_type is not None:
            _queryset = _queryset.filter(file_type=file_type)

        return _queryset

    def perform_create(self, serializer):
        serializer.save(
            asset=self.asset,
            user=self.request.user
        )

    def perform_destroy(self, *args, **kwargs):
        # Delete file
        try:
            private_file = self.get_object()
            private_file.content.delete(save=False)
        except OSError:
            pass

        return super().perform_destroy(*args, **kwargs)

    class PrivateContentView(PrivateStorageDetailView):
        model = AssetFile
        model_file_field = 'content'

        def can_access_file(self, private_file):
            return private_file.request.user.has_perm(
                PERM_VIEW_ASSET, private_file.parent_object.asset)

    @action(detail=True, methods=['get'])
    def content(self, *args, **kwargs):
        view = self.PrivateContentView.as_view(
            model=AssetFile,
            slug_url_kwarg='uid',
            slug_field='uid',
            model_file_field='content'
        )
        af = self.get_object()
        # TODO: simply redirect if external storage with expiring tokens (e.g.
        # Amazon S3) is used?
        #   return HttpResponseRedirect(af.content.url)
        return view(self.request, uid=af.uid)
