# coding: utf-8
from django.conf import settings
from django.contrib.postgres.fields import JSONField as JSONBField
from django.db import migrations, models
from django.utils import timezone
from jsonfield.fields import JSONField

import kpi.fields
from kpi.management.commands.populate_assetversions import populate_assetversions


def copy_reversion_to_assetversion(apps, schema_editor):
    if settings.SKIP_HEAVY_MIGRATIONS:
        print("""
            !!! ATTENTION !!!
            If you have existing projects you need to run this management command:

               > python manage.py populate_assetversions

            Otherwise, projects will not display previous versions.
            This command can take a long time, but it is idempotent
            so you can run it even if you are not sure if it is
            necessary.
            """)
    else:
        print("""
            This might take a while. If it is too slow, you may want to re-run the
            migration with SKIP_HEAVY_MIGRATIONS=True and run the management command
            (populate_assetversions) to prepare the versions.
            """)
        populate_assetversions(apps.get_model('kpi', 'Asset'),
                               apps.get_model('kpi', 'AssetVersion'),
                               apps.get_model('reversion', 'Version'),
                               )


# allow this command to be run backwards
def noop(apps, schema_editor):
    pass


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
                ('uid', kpi.fields.KpiUidField(uid_prefix='v')),
                ('name', models.CharField(max_length=255, null=True)),
                ('date_modified', models.DateTimeField(default=timezone.now)),
                ('version_content', JSONBField()),
                ('deployed_content', JSONBField(null=True)),
                ('_deployment_data', JSONBField(default=False)),
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
            field=JSONBField(default=dict),
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
        migrations.RunPython(
            copy_reversion_to_assetversion,
            noop,
        ),
    ]
