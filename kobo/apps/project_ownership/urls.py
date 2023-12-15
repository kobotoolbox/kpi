from django.urls import path, include
from rest_framework_extensions.routers import ExtendedDefaultRouter

from .views import InviteViewSet, TransferViewSet


router = ExtendedDefaultRouter()
invite_router = router.register(
    r'project-ownership/invites', InviteViewSet, basename='project-ownership-invite'
)
invite_router.register(
    r'transfers',
    TransferViewSet,
    basename='project-ownership-transfer',
    parents_query_lookups=['invite_uid'],
)

urlpatterns = [
    path('', include(router.urls)),
]
