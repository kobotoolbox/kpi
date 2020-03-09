# coding: utf-8
from django.db import migrations, models
import jsonfield.fields


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0019_add_report_custom_field'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='asset',
            options={'ordering': ('-date_modified',), 'permissions': (('view_asset', 'Can view asset'), ('share_asset', "Can change asset's sharing settings"), ('add_submissions', 'Can submit data to asset'), ('view_submissions', 'Can view submitted data for asset'), ('change_submissions', 'Can modify submitted data for asset'), ('delete_submissions', 'Can delete submitted data for asset'), ('share_submissions', "Can change sharing settings for asset's submitted data"), ('validate_submissions', 'Can validate submitted data asset'), ('from_kc_only', 'INTERNAL USE ONLY; DO NOT ASSIGN'))},
        ),
    ]
