# coding: utf-8
from django.db import migrations, models
import jsonfield.fields


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0009_auto_20160315_0343'),
    ]

    operations = [
        migrations.AddField(
            model_name='asset',
            name='_deployment_data',
            field=jsonfield.fields.JSONField(default=dict),
        ),
    ]
