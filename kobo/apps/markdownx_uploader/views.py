from private_storage.views import PrivateStorageView
from markdownx.views import ImageUploadView


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
        return private_file.request.user.is_authenticated
