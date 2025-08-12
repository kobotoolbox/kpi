from django.db.models.signals import post_delete, pre_delete
from django.dispatch import receiver

from kobo.apps.openrosa.apps.viewer.models.export import Export
from kobo.apps.openrosa.apps.viewer.models.parsed_instance import ParsedInstance
from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage as default_storage,
)
from kpi.utils.mongo_helper import MongoHelper


@receiver(post_delete, sender=Export)
def export_delete_callback(sender, **kwargs):
    export = kwargs['instance']
    if export.filepath and default_storage.exists(export.filepath):
        default_storage.delete(export.filepath)


@receiver(pre_delete, sender=ParsedInstance)
def remove_from_mongo(sender, **kwargs):
    instance_id = kwargs.get('instance').instance.id
    MongoHelper.delete_one({'_id': instance_id})
