# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations
import jsonbfield.fields


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0020_add_validate_submissions_permission_to_asset'),
    ]

    operations = [
        migrations.AddField(
            model_name='asset',
            name='map_custom',
            field=jsonbfield.fields.JSONField(default=dict),
        ),
        migrations.AddField(
            model_name='asset',
            name='map_styles',
            field=jsonbfield.fields.JSONField(default=dict),
        ),
    ]
