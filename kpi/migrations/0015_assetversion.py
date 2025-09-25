# coding: utf-8
from django.db import migrations, models
from django.utils import timezone
from jsonfield.fields import JSONField

import kpi.fields


class Migration(migrations.Migration):

    dependencies = [
        ('reversion', '0001_squashed_0004_auto_20160611_1202'),
        ('kpi', '0014_discoverable_subscribable_collections'),
    ]

    operations = [
        migrations.CreateModel(
            name='AssetVersion',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('uid', kpi.fields.KpiUidField(uid_prefix='v')),
                ('name', models.CharField(max_length=255, null=True)),
                ('date_modified', models.DateTimeField(default=timezone.now)),
                ('version_content', models.JSONField()),
                ('deployed_content', models.JSONField(null=True)),
                ('_deployment_data', models.JSONField(default=False)),
                ('deployed', models.BooleanField(default=False)),
                ('_reversion_version', models.OneToOneField(null=True, on_delete=models.SET_NULL,
                                                            to='reversion.Version')),
                ('asset', models.ForeignKey(related_name='asset_versions',
                                            to='kpi.Asset', on_delete=models.CASCADE)),
            ],
            options={
                'ordering': ['-date_modified'],
            },
        ),
        migrations.AlterField(
            model_name='asset',
            name='summary',
            field=JSONField(default=dict, null=True),
        ),
        migrations.AddField(
            model_name='asset',
            name='report_styles',
            field=models.JSONField(default=dict),
        ),
        migrations.RenameField(
            model_name='assetsnapshot',
            old_name='asset_version_id',
            new_name='_reversion_version_id',
        ),
        migrations.AddField(
            model_name='assetsnapshot',
            name='asset_version',
            field=models.OneToOneField(null=True, on_delete=models.CASCADE,
                                       to='kpi.AssetVersion'),
        ),
    ]
