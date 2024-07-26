# coding: utf-8
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('logger', '0010_attachment_media_file_basename'),
    ]

    # Because some servers already have these modifications applied by Django South migration,
    # we need to delete old indexes to let django recreate them according to Django migration requirements.
    #
    # see old migration in kobo.apps.openrosa/apps/logger/south_migrations/0032_index_uuid.py

    operations = [
        migrations.RunSQL(
            "DROP INDEX IF EXISTS odk_logger_xform_uuid_idx;"
        ),
        migrations.RunSQL(
            "DROP INDEX IF EXISTS odk_logger_instance_uuid_idx;"
        ),
        migrations.AlterField(
            model_name='instance',
            name='uuid',
            field=models.CharField(default='', max_length=249, db_index=True),
        ),
        migrations.AlterField(
            model_name='xform',
            name='uuid',
            field=models.CharField(default='', max_length=32, db_index=True),
        ),
    ]
