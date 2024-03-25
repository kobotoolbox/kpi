from django.urls import reverse
from django.utils.deconstruct import deconstructible
from private_storage import appconfig
from storages.backends.azure_storage import AzureStorage


@deconstructible
class PrivateAzureStorage(AzureStorage):
    """
    Ported from PrivateS3BotoStorage
    """
    def url(self, name, *args, **kwargs):
        # S3_REVERSE_PROXY because Azure doesn't exist in private_storage.appconfig
        if appconfig.PRIVATE_STORAGE_S3_REVERSE_PROXY or not self.querystring_auth:
            # There is no direct URL possible, return our streaming view instead.
            return reverse('serve_private_file', kwargs={'path': name})
        else:
            # The S3Boto3Storage can generate a presigned URL that is temporary available.
            return super().url(name, *args, **kwargs)
