# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import jsonfield.fields
import kpi.models.asset_file
import private_storage.storage.s3boto3
from django.conf import settings
import django.utils.timezone
import private_storage.fields
import kpi.models.import_export_task
import jsonbfield.fields


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('kpi', '0022_assetfile'),
    ]

    operations = [
        migrations.CreateModel(
            name='AssetUserSupervisorPermission',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('permissions', jsonbfield.fields.JSONField(default=dict)),
                ('date_created', models.DateTimeField(default=django.utils.timezone.now)),
                ('date_modified', models.DateTimeField(default=django.utils.timezone.now)),
            ],
        ),
        migrations.AddField(
            model_name='assetusersupervisorpermission',
            name='asset',
            field=models.ForeignKey(related_name='asset_supervisor_permissions', to='kpi.Asset'),
        ),
        migrations.AddField(
            model_name='assetusersupervisorpermission',
            name='user',
            field=models.ForeignKey(related_name='user_supervisor_permissions', to=settings.AUTH_USER_MODEL),
        ),
    ]
