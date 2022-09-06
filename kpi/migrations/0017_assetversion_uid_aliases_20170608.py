# coding: utf-8
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0016_asset_settings'),
    ]

    operations = [
        migrations.AddField(
            model_name='assetversion',
            name='uid_aliases',
            field=models.JSONField(null=True),
        ),
    ]
