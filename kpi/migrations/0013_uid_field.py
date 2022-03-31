# coding: utf-8
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
            field=kpi.fields.KpiUidField(uid_prefix='a'),
        ),
        migrations.AlterField(
            model_name='assetsnapshot',
            name='uid',
            field=kpi.fields.KpiUidField(uid_prefix='s'),
        ),
        migrations.AlterField(
            model_name='collection',
            name='uid',
            field=kpi.fields.KpiUidField(uid_prefix='c'),
        ),
        migrations.AlterField(
            model_name='importtask',
            name='uid',
            field=kpi.fields.KpiUidField(uid_prefix='i'),
        ),
        migrations.AlterField(
            model_name='objectpermission',
            name='uid',
            field=kpi.fields.KpiUidField(uid_prefix='p'),
        ),
        migrations.AlterField(
            model_name='taguid',
            name='uid',
            field=kpi.fields.KpiUidField(uid_prefix='t'),
        ),
    ]
