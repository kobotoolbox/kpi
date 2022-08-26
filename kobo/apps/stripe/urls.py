from django.shortcuts import reverse
from django.urls import include, re_path
from rest_framework.routers import SimpleRouter

from .views import ProductViewSet

router = SimpleRouter()
router.register(r'products', ProductViewSet)

urlpatterns = [
    re_path(r'^', include(router.urls)),
]
