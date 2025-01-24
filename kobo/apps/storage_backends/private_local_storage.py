import os
from django.conf import settings
from django.core.files.storage import FileSystemStorage


class PrivateLocalStorage(FileSystemStorage):
    def __init__(self, *args, **kwargs):
        # Override the location to the 'media' directory
        kwargs['location'] = os.path.join(settings.BASE_DIR, 'media')

        # Override the base_url to '/private-media/' so the files are served
        # from this path
        kwargs['base_url'] = '/private-media/'
        super().__init__(*args, **kwargs)
