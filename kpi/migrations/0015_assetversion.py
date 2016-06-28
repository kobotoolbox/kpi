# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import django.db.models.deletion
import datetime
import jsonbfield.fields
import jsonfield.fields
import kpi.fields


class Migration(migrations.Migration):

    dependencies = [
        ('reversion', '0002_auto_20141216_1509'),
        ('kpi', '0014_discoverable_subscribable_collections'),
    ]

    operations = [
        migrations.CreateModel(
            name='AssetVersion',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('uid', kpi.fields.KpiUidField(uid_prefix=b'v')),
                ('name', models.CharField(max_length=255, null=True)),
                ('date_modified', models.DateTimeField(default=datetime.datetime(2010, 1, 1, 0, 0))),
                ('version_content', jsonbfield.fields.JSONField()),
                ('deployed_content', jsonbfield.fields.JSONField(null=True)),
                ('_deployment_data', jsonbfield.fields.JSONField(default=False)),
                ('deployed', models.BooleanField(default=False)),
                ('_reversion_version', models.OneToOneField(null=True, on_delete=django.db.models.deletion.SET_NULL, to='reversion.Version')),
                ('asset', models.ForeignKey(related_name='asset_versions', to='kpi.Asset')),
            ],
            options={
                'ordering': ['-date_modified'],
            },
        ),
        migrations.AlterField(
            model_name='asset',
            name='summary',
            field=jsonfield.fields.JSONField(default=dict, null=True),
        ),
        migrations.AddField(
            model_name='asset',
            name='chart_styles',
            field=jsonbfield.fields.JSONField(default=dict),
        ),
        migrations.RenameField(
            model_name='assetsnapshot',
            old_name='asset_version_id',
            new_name='_reversion_version_id',
        ),
        migrations.AddField(
            model_name='assetsnapshot',
            name='asset_version',
            field=models.OneToOneField(null=True, on_delete=django.db.models.deletion.CASCADE, to='kpi.AssetVersion'),
        ),
    ]
