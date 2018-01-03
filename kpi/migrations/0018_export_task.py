# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import jsonfield.fields
from django.conf import settings
import kpi.models.import_export_task
import private_storage.fields
import private_storage.storage.files
import kpi.fields


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('kpi', '0017_assetversion_uid_aliases_20170608'),
    ]

    operations = [
        migrations.CreateModel(
            name='ExportTask',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('data', jsonfield.fields.JSONField()),
                ('messages', jsonfield.fields.JSONField(default={})),
                ('status', models.CharField(default=b'created', max_length=32, choices=[(b'created', b'created'), (b'processing', b'processing'), (b'error', b'error'), (b'complete', b'complete')])),
                ('date_created', models.DateTimeField(auto_now_add=True)),
                ('uid', kpi.fields.KpiUidField(uid_prefix=b'e')),
                ('last_submission_time', models.DateTimeField(null=True)),
                ('result', private_storage.fields.PrivateFileField(storage=private_storage.storage.files.PrivateFileSystemStorage(), max_length=380, upload_to=kpi.models.import_export_task.export_upload_to)),
                ('user', models.ForeignKey(to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'abstract': False,
            },
        ),
    ]
