from django.urls import path
from rest_framework import routers

from kobo.apps.kobo_scim.views import (
    ScimGroupViewSet,
    ScimServiceProviderConfigView,
    ScimUserViewSet,
)

app_name = 'kobo_scim'

# SCIM endpoints often do not use trailing slashes natively
router = routers.SimpleRouter(trailing_slash=False)
router.register(r'(?P<idp_slug>[^/.]+)/Users', ScimUserViewSet, basename='scim-users')
router.register(
    r'(?P<idp_slug>[^/.]+)/Groups', ScimGroupViewSet, basename='scim-groups'
)

urlpatterns = [
    path(
        '<slug:idp_slug>/ServiceProviderConfig',
        ScimServiceProviderConfigView.as_view(),
        name='scim-service-provider-config',
    ),
] + router.urls
