from rest_framework import routers


from .views import OrganizationViewSet, OrganizationUserViewSet


router = routers.SimpleRouter()
router.register(
    r'organizations',
    OrganizationViewSet,
    basename='organizations',
)
router.register(
    r'organizations/(?P<organization_id>[-\w]+)/users',
    OrganizationUserViewSet,
    basename='organization-users',
)
