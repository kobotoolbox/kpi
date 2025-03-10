# Generated by Django 4.2.15 on 2024-11-26 19:55

import django.db.models.deletion
import private_storage.fields
import private_storage.storage.files
from django.conf import settings
from django.db import migrations, models

import kpi.fields.file
import kpi.fields.kpi_uid
import kpi.models.asset_file
import kpi.models.import_export_task


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('kpi', '0059_assetexportsettings_date_created_and_more'),
    ]

    operations = [
        migrations.RenameModel(
            old_name='ExportTask',
            new_name='SubmissionExportTask',
        ),
        migrations.RenameModel(
            old_name='SynchronousExport',
            new_name='SubmissionSynchronousExport',
        ),
        migrations.AlterField(
            model_name='assetfile',
            name='content',
            field=kpi.fields.file.PrivateExtendedFileField(
                max_length=380, null=True, upload_to=kpi.models.asset_file.upload_to
            ),
        ),
        migrations.CreateModel(
            name='AccessLogExportTask',
            fields=[
                (
                    'id',
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID',
                    ),
                ),
                ('data', models.JSONField()),
                ('messages', models.JSONField(default=dict)),
                (
                    'status',
                    models.CharField(
                        choices=[
                            ('created', 'created'),
                            ('processing', 'processing'),
                            ('error', 'error'),
                            ('complete', 'complete'),
                        ],
                        default='created',
                        max_length=32,
                    ),
                ),
                ('date_created', models.DateTimeField(auto_now_add=True)),
                ('uid', kpi.fields.kpi_uid.KpiUidField(_null=False, uid_prefix='ale')),
                ('get_all_logs', models.BooleanField(default=False)),
                (
                    'result',
                    private_storage.fields.PrivateFileField(
                        max_length=380,
                        storage=(
                            private_storage.storage.files.PrivateFileSystemStorage()
                        ),
                        upload_to=kpi.models.import_export_task.export_upload_to,
                    ),
                ),
                (
                    'user',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                'abstract': False,
            },
            bases=(kpi.models.import_export_task.ExportTaskMixin, models.Model),
        ),
    ]
