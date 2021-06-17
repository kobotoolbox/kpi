# coding: utf-8
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0008_authorizedapplication'),
    ]

    operations = [
        migrations.AlterField(
            model_name='asset',
            name='uid',
            field=models.CharField(default='', unique=True, max_length=22),
        ),
        migrations.AlterField(
            model_name='assetsnapshot',
            name='uid',
            field=models.CharField(default='', unique=True, max_length=22),
        ),
        migrations.AlterField(
            model_name='collection',
            name='uid',
            field=models.CharField(default='', unique=True, max_length=22),
        ),
        migrations.AlterField(
            model_name='importtask',
            name='uid',
            field=models.CharField(default='', unique=True, max_length=22),
        ),
        migrations.AlterField(
            model_name='objectpermission',
            name='uid',
            field=models.CharField(default='', unique=True, max_length=22),
        ),
        migrations.AlterField(
            model_name='taguid',
            name='uid',
            field=models.CharField(default='', unique=True, max_length=22),
        ),
    ]
