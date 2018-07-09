# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import kpi.fields


class Migration(migrations.Migration):

    dependencies = [
        ('hook', '0005_alter_hook_log_message_to_textfield'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='hooklog',
            name='instance_id',
        ),
        migrations.AddField(
            model_name='hooklog',
            name='data_id',
            field=models.IntegerField(default=0, db_index=True),
        ),
        migrations.AlterField(
            model_name='hooklog',
            name='uid',
            field=kpi.fields.KpiUidField(uid_prefix=b'hl'),
        ),
    ]
