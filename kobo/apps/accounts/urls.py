from django.urls import include, path
from rest_framework import routers

from .views import EmailAddressViewSet, SocialAccountViewSet


router = routers.SimpleRouter()
router.register(r'emails', EmailAddressViewSet)
router.register(r'social-accounts', SocialAccountViewSet)

urlpatterns = [
    path('me/', include(router.urls)),
]
