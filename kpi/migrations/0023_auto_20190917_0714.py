# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import jsonfield.fields


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0022_assetfile'),
    ]

    operations = [
        migrations.AlterField(
            model_name='asset',
            name='_deployment_data',
            field=jsonfield.fields.JSONField(default=dict),
        ),
        migrations.AlterField(
            model_name='asset',
            name='asset_type',
            field=models.CharField(default='survey', max_length=20, choices=[('text', 'text'), ('empty', 'empty'), ('question', 'question'), ('block', 'block'), ('survey', 'survey'), ('template', 'template')]),
        ),
        migrations.AlterField(
            model_name='assetsnapshot',
            name='details',
            field=jsonfield.fields.JSONField(default=dict),
        ),
    ]
