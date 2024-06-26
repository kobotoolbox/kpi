# coding: utf-8
from django.db import migrations, models
import kobo.apps.openrosa.apps.logger.fields


class Migration(migrations.Migration):

    dependencies = [
        ('logger', '0008_add_instance_is_synced_with_mongo_and_xform_has_kpi_hooks'),
    ]

    operations = [
        migrations.AddField(
            model_name='instance',
            name='posted_to_kpi',
            field=kobo.apps.openrosa.apps.logger.fields.LazyDefaultBooleanField(default=False),
        ),
    ]
