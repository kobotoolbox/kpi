from django.urls import include, path
from rest_framework import routers

from .views import EmailAddressViewSet, SocialAccountViewSet
from .tos import TOSView


router = routers.SimpleRouter()
router.register(r'emails', EmailAddressViewSet)
router.register(r'social-accounts', SocialAccountViewSet)

urlpatterns = [
    path('me/', include(router.urls)),
    path('me/tos/', TOSView.as_view(), name='tos'),
]
