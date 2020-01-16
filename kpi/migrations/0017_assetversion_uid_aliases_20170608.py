# coding: utf-8
from django.contrib.postgres.fields import JSONField as JSONBField
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0016_asset_settings'),
    ]

    operations = [
        migrations.AddField(
            model_name='assetversion',
            name='uid_aliases',
            field=JSONBField(null=True),
        ),
    ]
