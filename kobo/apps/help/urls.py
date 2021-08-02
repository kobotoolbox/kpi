# coding: utf-8
from django.urls import re_path, include
from rest_framework.routers import SimpleRouter

from .views import (
    InAppMessageFileContentView,
    InAppMessageImageUploadView,
    InAppMessageViewSet,
)


router = SimpleRouter()
router.register(r'in_app_messages', InAppMessageViewSet)

urlpatterns = [
    re_path(r'^in_app_message_upload/',
            InAppMessageImageUploadView.as_view(),
            name='in-app-message-image-upload'),
    re_path(r'^in_app_message_file/(?P<path>.*)$',
            InAppMessageFileContentView.as_view(),
            name='in-app-message-file-contents'),
    re_path(r'^', include(router.urls)),
]
