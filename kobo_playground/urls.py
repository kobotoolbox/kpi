from rest_framework.urlpatterns import format_suffix_patterns
from kpi.views import (
    SurveyAssetViewSet,
    UserViewSet,
    CollectionViewSet,
    TagViewSet,
    ObjectPermissionViewSet,
)
from rest_framework.routers import DefaultRouter
from rest_framework import renderers
from django.conf.urls import url, include
from kpi.views import current_user

router = DefaultRouter()
router.register(r'survey_assets', SurveyAssetViewSet)
router.register(r'collections', CollectionViewSet)
router.register(r'users', UserViewSet)
router.register(r'tags', TagViewSet)
router.register(r'permissions', ObjectPermissionViewSet)


urlpatterns = [
    url(r'^me/$', current_user),
    url(r'^', include(router.urls)),
    url(r'^api-auth/', include('rest_framework.urls',
                               namespace='rest_framework')),
]
