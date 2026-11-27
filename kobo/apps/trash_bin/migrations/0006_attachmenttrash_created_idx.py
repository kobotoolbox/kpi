from django.contrib.postgres.operations import AddIndexConcurrently
from django.db import migrations, models
from django.db.models.fields.json import KeyTransform


class Migration(migrations.Migration):

    atomic = False

    dependencies = [
        ('trash_bin', '0005_remove_garbage_collector_task'),
    ]

    operations = [
        AddIndexConcurrently(
            model_name='attachmenttrash',
            index=models.Index(
                fields=['date_created'], name='attachmenttrash_created_idx'
            ),
        ),
        AddIndexConcurrently(
            model_name='attachmenttrash',
            index=models.Index(
                KeyTransform('asset_uid', 'metadata'),
                'date_created',
                name='attachmenttrash_asset_idx',
            ),
        ),
    ]
