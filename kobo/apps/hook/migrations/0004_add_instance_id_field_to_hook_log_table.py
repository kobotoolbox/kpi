# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hook', '0003_add_success_field_to_hook_logs'),
    ]

    operations = [
        migrations.AddField(
            model_name='hooklog',
            name='instance_id',
            field=models.IntegerField(default=0),
        ),
    ]
