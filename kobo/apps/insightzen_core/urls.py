from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    DialerCancelView,
    DialerCompleteView,
    DialerNextView,
    InsightMembershipViewSet,
    InsightProjectViewSet,
    InsightUserViewSet,
    QuotaCellViewSet,
    QuotaSchemeViewSet,
)

router = DefaultRouter()
router.register('projects', InsightProjectViewSet, basename='insightzen-project')
router.register('users', InsightUserViewSet, basename='insightzen-user')
router.register('memberships', InsightMembershipViewSet, basename='insightzen-membership')
router.register('quota-schemes', QuotaSchemeViewSet, basename='insightzen-quota-scheme')
router.register('quota-cells', QuotaCellViewSet, basename='insightzen-quota-cell')

urlpatterns = [
    path('', include(router.urls)),
    path('quotas/dialer/next', DialerNextView.as_view(), name='insightzen-quota-dialer-next'),
    path('quotas/dialer/complete', DialerCompleteView.as_view(), name='insightzen-quota-dialer-complete'),
    path('quotas/dialer/cancel', DialerCancelView.as_view(), name='insightzen-quota-dialer-cancel'),
]
