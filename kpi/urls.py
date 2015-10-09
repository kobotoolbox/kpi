from django.conf.urls import url, include
from django.shortcuts import render
from rest_framework.urlpatterns import format_suffix_patterns
from rest_framework.routers import DefaultRouter
from rest_framework import renderers

from kpi.views import (
    AssetViewSet,
    AssetSnapshotViewSet,
    UserViewSet,
    CollectionViewSet,
    TagViewSet,
    ImportTaskViewSet,
    ObjectPermissionViewSet,
    AssetDeploymentViewSet,
    SitewideMessageViewSet,
)

from kpi.views import current_user, home

router = DefaultRouter()
router.register(r'assets', AssetViewSet)
router.register(r'asset_snapshots', AssetSnapshotViewSet)
router.register(r'collections', CollectionViewSet)
router.register(r'users', UserViewSet)
router.register(r'tags', TagViewSet)
router.register(r'permissions', ObjectPermissionViewSet)
router.register(r'imports', ImportTaskViewSet)
router.register(r'deployments', AssetDeploymentViewSet)
router.register(r'sitewide_messages', SitewideMessageViewSet)


urlpatterns = [
    url(r'^$', home, name='kpi-root'),
    url(r'^me/$', current_user, name='current-user'),
    url(r'^', include(router.urls)),
    url(r'^api-auth/', include('rest_framework.urls',
                               namespace='rest_framework')),
    #url(r'^accounts/logout/', 'django.contrib.auth.views.logout',
    #    {'next_page': '/'}),
    url(r'^accounts/', include('allauth.urls')),
    url(r'^o/', include('oauth2_provider.urls', namespace='oauth2_provider')),
    url(
        r'^account_confirmed/',
        lambda r: render(r, 'account_confirmed.html'),
        name='account-confirmed'
    ),
]
