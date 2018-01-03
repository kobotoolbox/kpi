# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import jsonfield.fields


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0017_assetversion_uid_aliases_20170608'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='asset',
            options={'ordering': ('-date_modified',), 'permissions': (('view_asset', 'Can view asset'), ('share_asset', "Can change asset's sharing settings"), ('add_submissions', 'Can submit data to asset'), ('view_submissions', 'Can view submitted data for asset'), ('change_submissions', 'Can modify submitted data for asset'), ('delete_submissions', 'Can delete submitted data for asset'), ('share_submissions', "Can change sharing settings for asset's submitted data"), ('validate_submissions', 'Can validate submitted data asset'), ('from_kc_only', 'INTERNAL USE ONLY; DO NOT ASSIGN'))},
        ),
        migrations.AlterField(
            model_name='asset',
            name='_deployment_data',
            field=jsonfield.fields.JSONField(default=dict),
        ),
        migrations.AlterField(
            model_name='asset',
            name='asset_type',
            field=models.CharField(default=b'survey', max_length=20, choices=[(b'text', b'text'), (b'question', b'question'), (b'block', b'block'), (b'survey', b'survey'), (b'empty', b'empty')]),
        ),
        migrations.AlterField(
            model_name='assetsnapshot',
            name='details',
            field=jsonfield.fields.JSONField(default=dict),
        ),
    ]
