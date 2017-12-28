# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import jsonfield.fields
import jsonbfield.fields


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0018_export_task'),
    ]

    operations = [
        migrations.AddField(
            model_name='asset',
            name='report_custom',
            field=jsonbfield.fields.JSONField(default=dict),
        ),
    ]
