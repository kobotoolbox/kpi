# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hook', '0002_create_model_hook_log_alter_model_hook'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='hook',
            name='failed_count',
        ),
        migrations.RemoveField(
            model_name='hook',
            name='success_count',
        ),
        migrations.AddField(
            model_name='hooklog',
            name='success',
            field=models.BooleanField(default=True),
        ),
    ]
