from django.urls import reverse
from django.utils import timezone
from django.utils.deconstruct import deconstructible
from private_storage import appconfig
from storages.backends.azure_storage import AzureStorage
from storages.utils import setting


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

    def get_modified_time(self, name):
        # workaround https://github.com/jschneier/django-storages/issues/1131
        # If fixed upstream, delete this function
        properties = self.client.get_blob_client(
            self._get_valid_path(name)
        ).get_blob_properties(
            timeout=self.timeout
        )
        if not setting('USE_TZ', False):
            return timezone.make_naive(properties.last_modified)

        tz = timezone.get_current_timezone()
        if timezone.is_naive(properties.last_modified):
            return timezone.make_aware(properties.last_modified, tz)

        # `last_modified` is in UTC time_zone, we
        # must convert it to settings time_zone
        return properties.last_modified.astimezone(tz)
