from django.conf.urls import url, include
from rest_framework.urlpatterns import format_suffix_patterns
from rest_framework.routers import DefaultRouter
from rest_framework import renderers
from registration.backends.default.views import RegistrationView

from kpi.views import (
    AssetViewSet,
    AssetSnapshotViewSet,
    UserViewSet,
    CollectionViewSet,
    TagViewSet,
    ImportTaskViewSet,
    ObjectPermissionViewSet,
    AssetDeploymentViewSet,
)
from kpi.views import current_user, home
from kpi.forms import RegistrationForm

router = DefaultRouter()
router.register(r'assets', AssetViewSet)
router.register(r'asset_snapshots', AssetSnapshotViewSet)
router.register(r'collections', CollectionViewSet)
router.register(r'users', UserViewSet)
router.register(r'tags', TagViewSet)
router.register(r'permissions', ObjectPermissionViewSet)
router.register(r'imports', ImportTaskViewSet)
router.register(r'deployments', AssetDeploymentViewSet)


urlpatterns = [
    url(r'^$', home),
    url(r'^me/$', current_user),
    url(r'^', include(router.urls)),
    url(r'^api-auth/', include('rest_framework.urls',
                               namespace='rest_framework')),
    url(r'^accounts/register/$', RegistrationView.as_view(
        form_class=RegistrationForm), name='registration_register'),
    url(r'^accounts/logout/', 'django.contrib.auth.views.logout',
        {'next_page': '/'}),
    url(r'^accounts/', include('registration.backends.default.urls')),
]
