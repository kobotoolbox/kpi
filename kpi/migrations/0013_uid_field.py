# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import kpi.fields


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0012_onetimeauthenticationkey'),
    ]

    operations = [
        migrations.AlterField(
            model_name='asset',
            name='uid',
            field=kpi.fields.KpiUidField(uid_prefix=b'a'),
        ),
        migrations.AlterField(
            model_name='assetsnapshot',
            name='uid',
            field=kpi.fields.KpiUidField(uid_prefix=b's'),
        ),
        migrations.AlterField(
            model_name='collection',
            name='uid',
            field=kpi.fields.KpiUidField(uid_prefix=b'c'),
        ),
        migrations.AlterField(
            model_name='importtask',
            name='uid',
            field=kpi.fields.KpiUidField(uid_prefix=b'i'),
        ),
        migrations.AlterField(
            model_name='objectpermission',
            name='uid',
            field=kpi.fields.KpiUidField(uid_prefix=b'p'),
        ),
        migrations.AlterField(
            model_name='taguid',
            name='uid',
            field=kpi.fields.KpiUidField(uid_prefix=b't'),
        ),
    ]
