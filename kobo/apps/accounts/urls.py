from django.urls import include, path, re_path
from rest_framework import routers

from .tos import TOSView
from .views import (
    EmailAddressViewSet,
    OrganizationalPaymentView,
    SocialAccountViewSet,
)

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
    path(
        'organizational-payment/',
        OrganizationalPaymentView.as_view(),
        name='account_organizational_payment',
    ),
]
