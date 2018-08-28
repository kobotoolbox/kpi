# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hook', '0002_hook_table_creation'),
    ]

    operations = [
        migrations.AddField(
            model_name='hook',
            name='email_notification',
            field=models.BooleanField(default=True),
        ),
    ]
