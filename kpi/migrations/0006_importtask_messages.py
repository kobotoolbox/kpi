# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
import jsonfield.fields


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0005_taguid'),
    ]

    operations = [
        migrations.AddField(
            model_name='importtask',
            name='messages',
            field=jsonfield.fields.JSONField(default={}),
            preserve_default=False,
        ),
    ]
