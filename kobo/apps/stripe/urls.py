from django.urls import include, re_path
from rest_framework.routers import SimpleRouter


from kobo.apps.stripe.views import (
    ProductViewSet,
    SubscriptionViewSet,
)

router = SimpleRouter()
router.register(r'products', ProductViewSet, basename='products')
router.register(r'subscriptions', SubscriptionViewSet, basename='subscriptions')

urlpatterns = [
    re_path(r'^', include(router.urls)),
]
