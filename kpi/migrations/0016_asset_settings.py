# coding: utf-8
from django.db import migrations
from django.contrib.postgres.fields import JSONField as JSONBField


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0015_assetversion'),
    ]

    operations = [
        migrations.AddField(
            model_name='asset',
            name='settings',
            field=JSONBField(default=dict),
        ),
    ]
