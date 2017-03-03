import contextlib
import haystack
import logging
from django.apps import apps as kpi_apps
from django.db import models
from django.conf import settings
from django.core import exceptions

def update_object_in_search_index(obj):
    '''
    If a search index exists for the type of `obj`, update it. Otherwise, do
    nothing
    '''
    try:
        index = haystack.connections['default'].get_unified_index().get_index(
            type(obj))
    except haystack.exceptions.NotHandled:
        # There's nothing to update because this type of object is not indexed
        logging.warning(
            'No search index for type {}'.format(type(obj)), exc_info=True)
        return
    index.update_object(obj)


class SignalProcessor(haystack.signals.BaseSignalProcessor):
    """
    Allows for observing when saves/deletes fire & automatically updates the
    search engine appropriately.
    """
    def __init__(self, *args, **kwargs):
        self.signal_models = []
        self.tagged_item_model = None
        # Instruct `load_models()` not to call `setup()` since Haystack
        # does that for us
        self.load_models(setup=False)
        super(SignalProcessor, self).__init__(*args, **kwargs)

    def load_models(self, setup=True):
        for app_label, model_name in settings.HAYSTACK_SIGNAL_MODELS:
            app_config = kpi_apps.get_app_config(app_label)
            self.signal_models.append(app_config.get_model(model_name))
        # TaggedItem is a special case. Load it with AppConfig to support
        # Django 1.9
        self.tagged_item_model = kpi_apps.get_app_config('taggit').get_model(
            'TaggedItem')
        # If this is being called after initialization, it's also necessary to
        # call `setup()` to connect the newly-loaded signals
        if setup:
            self.setup()

    def setup(self):
        for model in self.signal_models:
            models.signals.post_save.connect(self.handle_save, sender=model)
            models.signals.post_delete.connect(
                self.handle_delete, sender=model)

        if self.tagged_item_model:
            models.signals.post_save.connect(
                self.handle_tagged_item_save, sender=self.tagged_item_model)
            models.signals.post_delete.connect(
                self.handle_tagged_item_delete, sender=self.tagged_item_model)

    def teardown(self):
        for model in self.signal_models:
            models.signals.post_save.disconnect(
                self.handle_save, sender=model)
            models.signals.post_delete.disconnect(
                self.handle_delete, sender=model)

        if self.tagged_item_model:
            models.signals.post_save.disconnect(
                self.handle_tagged_item_save, sender=self.tagged_item_model)
            models.signals.post_delete.disconnect(
                self.handle_tagged_item_delete, sender=self.tagged_item_model)

    @staticmethod
    def handle_tagged_item_save(sender, instance, created, raw, **kwargs):
        '''
        TaggedItem is the through model for the tag-to-object M2M relationship.
        When a TaggedItem is saved, we need to update the search index for the tag
        itself, as well as the tagged item
        '''
        if raw:
            # Since we touch other objects, we cannot run when the database is
            # not yet consistent
            return
        # Update the search index for the tag itself
        update_object_in_search_index(instance.tag)
        # Update the search index for the tagged object
        update_object_in_search_index(instance.content_object)

    @staticmethod
    def handle_tagged_item_delete(sender, instance, **kwargs):
        update_object_in_search_index(instance.tag)
        update_object_in_search_index(instance.content_object)

    @contextlib.contextmanager
    def defer(self):
        ''' Do not perform any automatic, real-time Haystack indexing for
        operations performed inside the body of the `with` block '''
        self.teardown()
        yield
        self.setup()
