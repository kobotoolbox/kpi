import sys

from django.contrib.auth.management import create_permissions
from django.contrib.auth.models import AnonymousUser
from django.db import migrations


def create_new_perms(apps):
    """
    The new `manage_asset` permission does not exist when running this
    migration for the first time. Django runs migrations in a transaction and
    new permissions are not created until after the transaction is completed.

    See https://stackoverflow.com/a/40092780/1141214
    """
    for app_config in apps.get_app_configs():
        app_config.models_module = True
        create_permissions(app_config, apps=apps, verbosity=0)
        app_config.models_module = None


def grant_object_level_perms(apps):
    """
    Grant `manage_asset` to the owner of every asset
    """
    ContentType = apps.get_model('contenttypes', 'ContentType')  # noqa
    User = apps.get_model('auth', 'User')  # noqa
    Permission = apps.get_model('auth', 'Permission')  # noqa
    Asset = apps.get_model('kpi', 'Asset')  # noqa
    ObjectPermission = apps.get_model('kpi', 'ObjectPermission')  # noqa

    new_perm = Permission.objects.get(
        content_type__app_label='kpi', codename='manage_asset'
    )
    content_type = ContentType.objects.get_for_model(Asset)
    new_perm_objects = []
    for asset in Asset.objects.only('owner_id'):
        new_perm_assignment = ObjectPermission(
            permission_id=new_perm.pk,
            user_id=asset.owner_id,
            object_id=asset.pk,
            content_type_id=content_type.pk,
        )
        new_perm_objects.append(new_perm_assignment)
    sys.stderr.write(
        'Creating {} object-level permission assignments...\n'.format(
            len(new_perm_objects)
        )
    )
    sys.stderr.flush()
    ObjectPermission.objects.bulk_create(
        new_perm_objects, ignore_conflicts=True
    )


def remove_object_level_perms(apps):
    """
    Remove all object-level 'manage_asset' permission assignments
    """
    Permission = apps.get_model('auth', 'Permission')  # noqa
    ObjectPermission = apps.get_model('kpi', 'ObjectPermission')  # noqa
    perm = Permission.objects.get(
        content_type__app_label='kpi', codename='manage_asset'
    )
    ObjectPermission.objects.filter(permission=perm).delete()


def forwards_func(apps, schema_editor):
    sys.stderr.write(
        'Granting `manage_asset` to all asset owners. This may take several '
        'minutes on large databases...\n'
    )
    sys.stderr.flush()
    create_new_perms(apps)
    grant_object_level_perms(apps)


def reverse_func(apps, schema_editor):
    remove_object_level_perms(apps)


class Migration(migrations.Migration):
    dependencies = [
        ('kpi', '0027_add_manage_asset_permission'),
    ]
    operations = [
        migrations.RunPython(forwards_func, reverse_func),
    ]

