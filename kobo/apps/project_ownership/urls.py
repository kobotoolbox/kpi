from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import InviteViewSet, TransferViewSet


router = DefaultRouter()
router.register(
    r'project-ownership/invites', InviteViewSet, basename='project-ownership-invites'
)
router.register(
    r'project-ownership/transfers', TransferViewSet, basename='project-ownership-transfers'
)

urlpatterns = [
    path('', include(router.urls)),
]
