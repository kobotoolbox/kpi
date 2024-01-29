# coding: utf-8
from django.db import migrations, models
import kobo.apps.open_rosa_server.apps.logger.fields


class Migration(migrations.Migration):

    dependencies = [
        ('logger', '0008_add_instance_is_synced_with_mongo_and_xform_has_kpi_hooks'),
    ]

    operations = [
        migrations.AddField(
            model_name='instance',
            name='posted_to_kpi',
            field=kobo.apps.open_rosa_server.apps.logger.fields.LazyDefaultBooleanField(default=False),
        ),
    ]
