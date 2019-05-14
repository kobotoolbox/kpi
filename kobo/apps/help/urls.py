# coding: utf-8

from django.conf.urls import url, include
from rest_framework.routers import SimpleRouter

from .views import (
    InAppMessageFileContentView,
    InAppMessageImageUploadView,
    InAppMessageViewSet,
)


router = SimpleRouter()
router.register(r'in_app_messages', InAppMessageViewSet)

urlpatterns = [
    url(r'^in_app_message_upload/',
        InAppMessageImageUploadView.as_view(),
        name='in-app-message-image-upload'),
    url(r'^in_app_message_file/(?P<path>.*)$',
        InAppMessageFileContentView.as_view(),
        name='in-app-message-file-contents'),
    url(r'^', include(router.urls)),
]
