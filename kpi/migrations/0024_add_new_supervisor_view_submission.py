# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import jsonfield.fields
import kpi.models.asset_file
import private_storage.fields
import kpi.models.import_export_task
import private_storage.storage.s3boto3


class Migration(migrations.Migration):
    dependencies = [
        ('kpi', '0023_create_many_to_many_asset_user_permissions'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='asset',
            options={
                'ordering': ('-date_modified',),
                'permissions': (
                    ('view_asset', 'Can view asset'),
                    ('share_asset', "Can change asset's sharing settings"),
                    ('add_submissions', 'Can submit data to asset'),
                    ('view_submissions', 'Can view submitted data for asset'),
                    ('supervisor_view_submissions', 'Can view submitted data for asset for specific users'),
                    ('change_submissions', 'Can modify submitted data for asset'),
                    ('delete_submissions', 'Can delete submitted data for asset'),
                    ('share_submissions', "Can change sharing settings for asset's submitted data"),
                    ('validate_submissions', 'Can validate submitted data asset'),
                    ('from_kc_only', 'INTERNAL USE ONLY; DO NOT ASSIGN')
                )
            },
        ),
    ]
