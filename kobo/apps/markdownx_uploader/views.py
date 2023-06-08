from urllib.parse import urlparse

from private_storage.views import PrivateStorageView
from markdownx.views import ImageUploadView

from kpi.utils.urls import absolute_reverse
from .forms import MarkdownxUploaderImageForm
from .models import MarkdownxUploaderFile


class MarkdownxUploaderImageUploadView(ImageUploadView):
    """
    django-markdownx uses this view to POST files that a user drags-and-drops
    onto the editor (per `settings.MARKDOWNX_UPLOAD_URLS_PATH`)
    """
    form_class = MarkdownxUploaderImageForm


class MarkdownxUploaderFileContentView(PrivateStorageView):
    """
    A view that allows any authenticated user to access the contents of an
    `InAppMessageFile`. The primary purpose is to override
    `settings.PRIVATE_STORAGE_AUTH_FUNCTION`
    """
    model = MarkdownxUploaderFile
    model_file_field = 'content'

    def can_access_file(self, private_file):

        if private_file.request.user.is_authenticated:
            return True

        try:
            referrer = self.request.META['HTTP_REFERER']
        except KeyError:
            return False

        parsed_url = urlparse(referrer)
        referrer = f'{parsed_url.scheme}://{parsed_url.netloc}{parsed_url.path}'
        return referrer == absolute_reverse('account_signup')
