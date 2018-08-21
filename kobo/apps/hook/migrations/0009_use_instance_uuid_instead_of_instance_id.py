# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hook', '0008_use_smallint_in_hooklog'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='hooklog',
            name='data_id',
        ),
        migrations.AddField(
            model_name='hooklog',
            name='instance_uuid',
            field=models.CharField(default=b'', max_length=36, db_index=True),
        ),
    ]
