# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hook', '0007_add_status_to_hook_log'),
    ]

    operations = [
        migrations.AlterField(
            model_name='hooklog',
            name='tries',
            field=models.PositiveSmallIntegerField(default=0),
        ),
    ]
