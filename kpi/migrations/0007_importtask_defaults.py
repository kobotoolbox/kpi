# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
import jsonfield.fields


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0006_importtask_messages'),
    ]

    operations = [
        migrations.AlterField(
            model_name='importtask',
            name='messages',
            field=jsonfield.fields.JSONField(default={}),
            preserve_default=True,
        ),
        migrations.AlterField(
            model_name='importtask',
            name='status',
            field=models.CharField(default=b'created', max_length=32, choices=[(b'created', b'created'), (b'processing', b'processing'), (b'error', b'error'), (b'complete', b'complete')]),
            preserve_default=True,
        ),
    ]
