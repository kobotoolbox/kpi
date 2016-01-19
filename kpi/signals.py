import contextlib
import haystack
from  django.db import models
from django.dispatch import receiver
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from taggit.models import Tag, TaggedItem
from .models import Collection, Asset, TagUid
from .model_utils import grant_default_model_level_perms
from .model_utils import update_object_in_search_index

@receiver(models.signals.post_save, sender=User)
def default_permissions_post_save(sender, instance, created, raw, **kwargs):
    '''
    Users must have both model-level and object-level permissions to satisfy
    DRF, so assign the newly-created user all available collection and asset
    permissions at the model level
    '''
    if raw:
        # `raw` means we can't touch (so make sure your fixtures include
        # all necessary permissions!)
        return
    if not created:
        # We should only grant default permissions when the user is first
        # created
        return
    grant_default_model_level_perms(instance)

@receiver(models.signals.post_save, sender=Tag)
def tag_uid_post_save(sender, instance, created, raw, **kwargs):
    ''' Make sure we have a TagUid object for each newly-created Tag '''
    if raw or not created:
        return
    TagUid.objects.get_or_create(tag=instance)

class HaystackSignalProcessor(haystack.signals.BaseSignalProcessor):
    """
    Allows for observing when saves/deletes fire & automatically updates the
    search engine appropriately.
    """
    HAYSTACK_SIGNAL_MODELS = (Asset, Collection, Tag)
    def setup(self):
        for model in self.HAYSTACK_SIGNAL_MODELS:
            models.signals.post_save.connect(self.handle_save, sender=model)
            models.signals.post_delete.connect(
                self.handle_delete, sender=model)

        models.signals.post_save.connect(
            self.handle_tagged_item_save, sender=TaggedItem)
        models.signals.post_delete.connect(
            self.handle_tagged_item_delete, sender=TaggedItem)

    def teardown(self):
        for model in self.HAYSTACK_SIGNAL_MODELS:
            models.signals.post_save.disconnect(
                self.handle_save, sender=model)
            models.signals.post_delete.disconnect(
                self.handle_delete, sender=model)

        models.signals.post_save.disconnect(
            self.handle_tagged_item_save, sender=TaggedItem)
        models.signals.post_delete.disconnect(
            self.handle_tagged_item_delete, sender=TaggedItem)

    def handle_save(self, sender, instance, **kwargs):
        if not getattr(instance, '_allow_signal_handler_to_index', True):
            # We were instructed to skip indexing here, probably because this
            # save is part of a bulk operation
            return
        return super(HaystackSignalProcessor, self).handle_save(
            sender, instance, **kwargs)

    def handle_delete(self, sender, instance, **kwargs):
        if not getattr(instance, '_allow_signal_handler_to_index', True):
            # We were instructed to skip indexing here, probably because this
            # delete is part of a bulk operation
            return
        return super(HaystackSignalProcessor, self).handle_delete(
            sender, instance, **kwargs)

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
