from django.urls import re_path

from .views import (
    MarkdownxUploaderImageUploadView,
    MarkdownxUploaderFileContentView,
)


urlpatterns = [
    re_path(
        r'^image-upload/',
        MarkdownxUploaderImageUploadView.as_view(),
        name='markdownx-uploader-image-upload'
    ),
    re_path(
        r'^file/(?P<path>.*)$',
        MarkdownxUploaderFileContentView.as_view(),
        name='markdownx-uploader-file-content'
    ),
]
