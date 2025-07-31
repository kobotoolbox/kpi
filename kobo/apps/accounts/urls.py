from django.urls import include, path, re_path
from rest_framework import routers

from .views import EmailAddressViewSet, SocialAccountViewSet
from .tos import TOSView


router = routers.SimpleRouter()
router.register(r'emails', EmailAddressViewSet)

socialaccount_list = SocialAccountViewSet.as_view({'get': 'list'})
socialaccount_detail = SocialAccountViewSet.as_view(
    {'get': 'retrieve', 'delete': 'destroy'}
)

urlpatterns = [
    path('me/', include(router.urls)),
    path('me/social-accounts/', socialaccount_list, name='socialaccount-list'),
    re_path(
        rf'^me/social-accounts/{SocialAccountViewSet.lookup_value_regex}/$',
        socialaccount_detail,
        name='socialaccount-detail',
    ),
    path('me/tos/', TOSView.as_view(), name='tos'),
]
