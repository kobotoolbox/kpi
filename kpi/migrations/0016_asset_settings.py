# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import jsonbfield.fields


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0015_assetversion'),
    ]

    operations = [
        migrations.AddField(
            model_name='asset',
            name='settings',
            field=jsonbfield.fields.JSONField(default=dict),
        ),
    ]
