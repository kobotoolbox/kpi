# coding: utf-8
from django.db import migrations, models
import kobo.apps.openrosa.apps.logger.fields


class Migration(migrations.Migration):

    dependencies = [
        ('logger', '0007_add_validate_permission_on_xform'),
    ]

    operations = [
        migrations.AddField(
            model_name='instance',
            name='is_synced_with_mongo',
            field=kobo.apps.openrosa.apps.logger.fields.LazyDefaultBooleanField(default=False),
        ),
        migrations.AddField(
            model_name='xform',
            name='has_kpi_hooks',
            field=kobo.apps.openrosa.apps.logger.fields.LazyDefaultBooleanField(default=False),
        ),
    ]
