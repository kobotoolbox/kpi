# coding: utf-8
from django.http import Http404
from django.utils.translation import gettext as t
from rest_framework import renderers
from rest_framework.response import Response


from kobo.apps.openrosa.apps.api.permissions import AttachmentObjectPermissions
from kobo.apps.openrosa.apps.logger.models.attachment import Attachment
from kobo.apps.openrosa.libs import filters
from kobo.apps.openrosa.libs.serializers.attachment_serializer import (
    AttachmentSerializer,
)
from kobo.apps.openrosa.libs.renderers.renderers import (
    MediaFileContentNegotiation,
    MediaFileRenderer,
)
from ..utils.rest_framework.viewsets import OpenRosaReadOnlyModelViewSet


class AttachmentViewSet(OpenRosaReadOnlyModelViewSet):
    """

    ## Lists attachments of all xforms
    >       GET /api/v1/media/
    > Example
    >
    >       curl -X GET https://example.com/api/v1/media

    > Response
    >
    >        [{
    >           "download_url": "http://example.com/api/v1/media/1.jpg",
    >           "small_download_url": "http://example.com/api/v1/media/1-small.jpg",
    >           "medium_download_url": "http://example.com/api/v1/media/\
1-medium.jpg",
    >           "filename": "doe/attachments/1408520136827.jpg",
    >           "id": 1,
    >           "instance": 1,
    >           "mimetype": "image/jpeg",
    >           "url": "http://example.com/api/v1/media/1",
    >           "xform": 1,
    >        }
    >        ...

    ## Retrieve details of an attachment
    ><pre class="prettyprint">  GET /api/v1/media/<code>{pk}</code></pre>
    >
    > Example
    >
    >       curl -X GET https://example.com/api/v1/media/1

    > Response
    >
    >        {
    >           "download_url": "http://example.com/api/v1/media/1.jpg",
    >           "small_download_url": "http://example.com/api/v1/media/1-small.jpg",
    >           "medium_download_url": "http://example.com/api/v1/media/\
1-medium.jpg",
    >           "filename": "doe/attachments/1408520136827.jpg",
    >           "id": 1,
    >           "instance": 1,
    >           "mimetype": "image/jpeg",
    >           "url": "http://example.com/api/v1/media/1",
    >           "xform": 1,
    >        }

    ## Retrieve an attachment file

    ><pre class="prettyprint">
    >     GET /api/v1/media/<code>{pk}.{format}</code></pre>
    >
    >         curl -X GET https://example.com/api/v1/media/1.png -o a.png

    Alternatively, if the request is made with an `Accept` header of the
    content type of the file the file would be returned e.g

    ><pre class="prettyprint">
    > GET /api/v1/media/<code>{pk}</code> Accept: image/png </pre>
    >
    > Example
    >
    >     curl -X GET https://example.com/api/v1/media/1 -H "Accept: image/png" -o
    >     a.png

    ## Lists attachments of a specific xform
    ><pre class="prettyprint">
    > GET /api/v1/media/?xform=<code>{xform}</code></pre>
    >
    > Example
    >
    >     curl -X GET https://example.com/api/v1/media?xform=1

    > Response
    >
    >        [{
    >           "download_url": "http://example.com/api/v1/media/1.jpg",
    >           "small_download_url": "http://example.com/api/v1/media/1-small.jpg",
    >           "medium_download_url": "http://example.com/api/v1/media/\
1-medium.jpg",
    >           "filename": "doe/attachments/1408520136827.jpg",
    >           "id": 1,
    >           "instance": 1,
    >           "mimetype": "image/jpeg",
    >           "url": "http://example.com/api/v1/media/1",
    >           "xform": 1,
    >        }
    >        ...

    ## Lists attachments of a specific instance
    ><pre class="prettyprint">
    > GET /api/v1/media?instance=<code>{instance}</code></pre>
    >
    > Example
    >
    >     curl -X GET https://example.com/api/v1/media?instance=1

    > Response
    >
    >        [{
    >           "download_url": "http://example.com/api/v1/media/1.jpg",
    >           "small_download_url": "http://example.com/api/v1/media/1-small.jpg",
    >           "medium_download_url": "http://example.com/api/v1/media/\
1-medium.jpg",
    >           "filename": "doe/attachments/1408520136827.jpg",
    >           "id": 1,
    >           "instance": 1,
    >           "mimetype": "image/jpeg",
    >           "url": "http://example.com/api/v1/media/1",
    >           "xform": 1,
    >        }
    >        ...

    ## Retrieve image link of an attachment
    ><pre class="prettyprint">  GET /api/v1/media/<code>{pk}</code></pre>
    >
    > Example
    >
    >       curl -X GET https://example.com/api/v1/media/1\
?filename=doe/attachments/1408520136827.jpg

    > Response
    >
    >        http://example.com/api/v1/media/1.jpg

    """
    content_negotiation_class = MediaFileContentNegotiation
    filter_backends = (filters.AttachmentFilter,)
    lookup_field = 'pk'
    queryset = Attachment.objects.all()
    permission_classes = (AttachmentObjectPermissions,)
    serializer_class = AttachmentSerializer
    renderer_classes = (
        renderers.JSONRenderer,
        renderers.BrowsableAPIRenderer,
        MediaFileRenderer)

    def retrieve(self, request, *args, **kwargs):
        self.object = self.get_object()

        if isinstance(request.accepted_renderer, MediaFileRenderer) \
                and self.object.media_file is not None:
            data = self.object.media_file.read()

            return Response(data, content_type=self.object.mimetype)

        filename = request.query_params.get('filename')
        serializer = self.get_serializer(self.object)

        if filename:
            if filename == self.object.media_file.name:
                return Response(serializer.get_download_url(self.object))
            else:
                raise Http404(t("Filename '%s' not found." % filename))

        return Response(serializer.data)
