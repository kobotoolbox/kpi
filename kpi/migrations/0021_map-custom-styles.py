# coding: utf-8
from django.db import migrations, models
import kpi.fields


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0020_add_validate_submissions_permission_to_asset'),
    ]

    operations = [
        migrations.AddField(
            model_name='asset',
            name='map_custom',
            field=kpi.fields.LazyDefaultJSONBField(default=dict),
        ),
        migrations.AddField(
            model_name='asset',
            name='map_styles',
            field=kpi.fields.LazyDefaultJSONBField(default=dict),
        ),
    ]
