from kpi.models import SurveyAsset
from kpi.models import Collection
from kpi.serializers import SurveyAssetSerializer
from kpi.serializers import CollectionSerializer
from kpi.serializers import UserSerializer
from django.contrib.auth.models import User
from rest_framework import permissions
from kpi.permissions import IsOwnerOrReadOnly
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.reverse import reverse
import markdown
import json
from rest_framework import (
    viewsets,
    renderers,
)
from rest_framework import status
from rest_framework.decorators import detail_route

from kpi.utils.ss_structure_to_mdtable import ss_structure_to_mdtable
from kpi.renderers import (
    AssetJsonRenderer,
    SSJsonRenderer,
    XFormRenderer,
    MdTableRenderer,
    XlsRenderer,
    EnketoPreviewLinkRenderer,
)


@api_view(('GET',))
def api_root(request, format=None):
    return Response({
        'users': reverse('user-list', request=request, format=format),
        'survey_assets': reverse('surveyasset-list', request=request, format=format),
        'collections': reverse('collection-list', request=request, format=format),
    })


class CollectionViewSet(viewsets.ModelViewSet):
    queryset = Collection.objects.all()
    serializer_class = CollectionSerializer
    permission_classes = (permissions.IsAuthenticatedOrReadOnly,
                          IsOwnerOrReadOnly,)
    lookup_field = 'uid'

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    """
    This viewset automatically provides `list` and `detail` actions.
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer

from rest_framework.parsers import MultiPartParser

class XlsFormParser(MultiPartParser):
    pass

class SurveyAssetViewSet(viewsets.ModelViewSet):
    """
    This viewset automatically provides `list`, `create`, `retrieve`,
    `update` and `destroy` actions.

    Additionally we also provide an extra `highlight` action.
    """
    queryset = SurveyAsset.objects.all()
    serializer_class = SurveyAssetSerializer
    permission_classes = (permissions.IsAuthenticatedOrReadOnly,
                          IsOwnerOrReadOnly,)
    lookup_field = 'uid'

    renderer_classes = (
                        renderers.BrowsableAPIRenderer,
                        AssetJsonRenderer,
                        SSJsonRenderer,
                        MdTableRenderer,
                        XFormRenderer,
                        XlsRenderer,
                        EnketoPreviewLinkRenderer,
                        )
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @detail_route(renderer_classes=[renderers.StaticHTMLRenderer])
    def table_view(self, request, *args, **kwargs):
        sa = self.get_object()
        ss_structure_to_mdtable(sa._to_ss_structure())
        return Response("<html><body><code><pre>%s</pre></code></body></html>" % json.dumps(sa._to_ss_structure(), indent=4))

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
