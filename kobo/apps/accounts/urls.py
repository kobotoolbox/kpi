from django.urls import include, path
from rest_framework import routers

from .views import EmailAddressViewSet


router = routers.SimpleRouter()
router.register(r'emails', EmailAddressViewSet)

urlpatterns = [
    path("me/", include(router.urls)),
]