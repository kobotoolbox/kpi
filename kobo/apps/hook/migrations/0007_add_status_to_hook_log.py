# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hook', '0006_alter_uid_to_kpifield_and_change_instance_id_to_data_id'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='hooklog',
            options={'ordering': ['-date_created']},
        ),
        migrations.RemoveField(
            model_name='hooklog',
            name='success',
        ),
        migrations.AddField(
            model_name='hooklog',
            name='status',
            field=models.PositiveSmallIntegerField(default=1),
        ),
    ]
