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


@api_view(('GET',))
def api_root(request, format=None):
    return Response({
        'users': reverse('user-list', request=request, format=format),
        'survey_drafts': reverse('survey-asset-list', request=request, format=format),
        'collections': reverse('collection-list', request=request, format=format),
    })



from rest_framework import viewsets
from rest_framework import renderers
from rest_framework.decorators import detail_route

class CollectionViewSet(viewsets.ModelViewSet):
    queryset = Collection.objects.all()
    serializer_class = CollectionSerializer
    permission_classes = (permissions.IsAuthenticatedOrReadOnly,
                          IsOwnerOrReadOnly,)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    """
    This viewset automatically provides `list` and `detail` actions.
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer

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

    @detail_route(renderer_classes=[renderers.StaticHTMLRenderer])
    def highlight(self, request, *args, **kwargs):
        survey_draft = self.get_object()
        return Response(survey_draft.highlighted)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
