import constance
from abc import ABC, abstractmethod
from google.cloud import storage
from googleapiclient import discovery
from django.conf import settings
from django.core.cache import cache

from kobo.apps.trackers.utils import update_nlp_counter
from .utils import google_credentials_from_constance_config
from ...constants import GOOGLE_CACHE_TIMEOUT, make_async_cache_key
from ...exceptions import SubsequenceTimeoutError


class GoogleTask(ABC):
    """
    Base class for Google transcription/translation task
    Contains common functions for returning async responses using the Operations API
    """

    def __init__(self):
        super().__init__()
        self.asset = None
        self.destination_path = None
        self.credentials = google_credentials_from_constance_config()
        self.storage_client = storage.Client(credentials=self.credentials)
        self.bucket = self.storage_client.bucket(bucket_name=settings.GS_BUCKET_NAME)

    @abstractmethod
    def begin_async_google_operation(self, *args: str) -> (object, int):
        return ({}, 0)

    @property
    @abstractmethod
    def counter_name(self):
        """
        Gets used by `update_nlp_counters()` - should begin with `google_`
        """
        return 'google_'

    def update_counters(self, amount) -> None:
        update_nlp_counter(
            self.counter_name,
            amount,
            self.asset.owner_id,
            self.asset.id,
        )

    @abstractmethod
    def append_operations_response(self, results, *args) -> [object]:
        pass

    @abstractmethod
    def append_api_response(self, results, *args) -> [object]:
        pass

    def handle_google_task_asynchronously(self, api_name, api_version, resource, *args):
        cache_key = make_async_cache_key(*args)
        # Stop Me If You Think You've Heard This One Before
        if operation_name := cache.get(cache_key):
            google_service = discovery.build(api_name, api_version, credentials=self.credentials)
            resource_path = resource.split('.')
            for subresource in resource_path:
                google_service = getattr(google_service, subresource)()
            operation = google_service.get(name=operation_name)
            operation = operation.execute()
            if not (operation.get('done') or operation.get('state') == 'SUCCEEDED'):
                raise SubsequenceTimeoutError

            transcript = self.append_operations_response(operation, *args)
        else:
            print(f'--couldn\'t find key {cache_key}')
            (results, amount) = self.begin_async_google_operation(*args)
            print(results.operation)
            cache.set(cache_key, results.operation.name, GOOGLE_CACHE_TIMEOUT)
            print(cache.get(cache_key))
            self.update_counters(amount)

            try:
                result = results.result(timeout=REQUEST_TIMEOUT)
            except TimeoutError as err:
                raise SubsequenceTimeoutError from err
            transcript = self.append_api_response(result, *args)

        cache.delete(cache_key)
        return transcript
