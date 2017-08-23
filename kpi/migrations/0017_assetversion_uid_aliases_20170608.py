# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import jsonfield.fields
import jsonbfield.fields


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0016_asset_settings'),
    ]

    operations = [
        migrations.AddField(
            model_name='assetversion',
            name='uid_aliases',
            field=jsonbfield.fields.JSONField(null=True),
        ),
    ]
