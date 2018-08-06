# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hook', '0004_add_instance_id_field_to_hook_log_table'),
    ]

    operations = [
        migrations.AlterField(
            model_name='hooklog',
            name='message',
            field=models.TextField(default=b''),
        ),
    ]
