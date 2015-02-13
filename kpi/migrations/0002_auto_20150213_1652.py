# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
import shortuuidfield.fields


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='collection',
            name='uuid',
            field=shortuuidfield.fields.ShortUUIDField(max_length=22, editable=False, blank=True),
            preserve_default=True,
        ),
        migrations.AddField(
            model_name='surveyasset',
            name='uuid',
            field=shortuuidfield.fields.ShortUUIDField(max_length=22, editable=False, blank=True),
            preserve_default=True,
        ),
    ]
