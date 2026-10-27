from django.contrib.auth.decorators import user_passes_test
from django.urls import re_path

from .views import (
    MarkdownxUploaderImageUploadView,
    MarkdownxUploaderFileContentView,
)


urlpatterns = [
    re_path(
        r'^image-upload/',
        user_passes_test(lambda u: u.is_superuser)(
            MarkdownxUploaderImageUploadView.as_view()
        ),
        name='markdownx-uploader-image-upload'
    ),
    re_path(
        r'^file/(?P<path>.*)$',
        MarkdownxUploaderFileContentView.as_view(),
        name='markdownx-uploader-file-content'
    ),
]
