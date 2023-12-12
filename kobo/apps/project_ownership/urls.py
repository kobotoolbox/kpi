from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import InviteViewSet, TransferViewSet

router = DefaultRouter()
router.register(
    r'invites', InviteViewSet, basename='project-ownership-invites'
)
router.register(
    r'transfers', TransferViewSet, basename='project-ownership-transfers'
)

urlpatterns = [
    path('project-ownership/', include(router.urls)),
]
