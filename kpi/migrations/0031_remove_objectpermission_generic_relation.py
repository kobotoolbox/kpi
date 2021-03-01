from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def remove_trash_objectpermissions(apps, schema_editor):
    """
    The `Collection` model has already been removed, so there should not be any
    `ObjectPermission`s left that reference it. We need to make sure because
    we'll later assume that all `ObjectPermission.object_id`s are pointing at
    `Asset`s. Let's also remove any `ObjectPermission`s that reference
    non-existant `Asset`s.
    """
    ContentType = apps.get_model('contenttypes', 'ContentType')
    Asset = apps.get_model('kpi', 'Asset')
    ObjectPermission = apps.get_model('kpi', 'ObjectPermission')
    asset_ct = ContentType.objects.get(app_label='kpi', model='asset')
    ObjectPermission.objects.exclude(content_type_id=asset_ct.pk).delete()
    related_assets = Asset.objects.filter(pk=models.OuterRef('object_id'))
    ObjectPermission.objects.annotate(
        _valid=models.Exists(related_assets.only('pk'))
    ).filter(_valid=False).delete()


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('auth', '0011_update_proxy_permissions'),
        ('kpi', '0030_delete_collections_fix_asset_parent_foreign_key'),
    ]

    operations = [
        migrations.RunPython(remove_trash_objectpermissions),
        migrations.RenameField(
            model_name='objectpermission',
            old_name='object_id',
            new_name='asset',
        ),
        migrations.AlterUniqueTogether(
            name='objectpermission',
            unique_together={
                ('user', 'permission', 'deny', 'inherited', 'asset')
            },
        ),
        migrations.AlterField(
            model_name='objectpermission',
            name='asset',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='permissions',
                to='kpi.Asset',
            ),
        ),
        migrations.RemoveField(
            model_name='objectpermission',
            name='content_type',
        ),
    ]
