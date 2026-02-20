from rest_framework import routers

from kobo.apps.kobo_scim.views import ScimUserViewSet

# SCIM endpoints often do not use trailing slashes natively
router = routers.SimpleRouter(trailing_slash=False)
router.register(r'(?P<idp_slug>[^/.]+)/Users', ScimUserViewSet, basename='scim-users')

urlpatterns = router.urls
