import sys

from django.contrib.auth.management import create_permissions
from django.contrib.auth.models import AnonymousUser
from django.db import migrations


def create_new_perms(apps):
    """
    The new `delete_submissions` permission does not exist when running this
    migration for the first time. Django runs migrations in a transaction and
    new permissions are not created until after the transaction is completed.

    See https://stackoverflow.com/a/40092780/1141214
    """
    for app_config in apps.get_app_configs():
        app_config.models_module = True
        create_permissions(app_config, apps=apps, verbosity=0)
        app_config.models_module = None


def grant_model_level_perms(apps):
    """
    Grant `delete_submissions` permission to everyone at the model level
    """
    User = apps.get_model('auth', 'User')  # noqa
    Permission = apps.get_model('auth', 'Permission')  # noqa
    ThroughModel = User.user_permissions.through  # noqa

    permission = Permission.objects.get(
        content_type__app_label='kpi', codename='delete_submissions'
    )
    user_ids = User.objects.values_list('pk', flat=True).exclude(
        pk=AnonymousUser().pk
    )

    through_models = []
    for user_id in user_ids:
        through_models.append(
            ThroughModel(user_id=user_id, permission_id=permission.pk)
        )

    sys.stderr.write(
        'Creating {} model-level permission assignments...\n'.format(
            len(through_models)
        )
    )
    sys.stderr.flush()
    ThroughModel.objects.bulk_create(through_models, ignore_conflicts=True)


def remove_model_level_perms(apps):
    """
    Remove all model-level 'delete_submissions' permission assignments
    """
    User = apps.get_model('auth', 'User')  # noqa
    Permission = apps.get_model('auth', 'Permission')  # noqa
    ThroughModel = User.user_permissions.through  # noqa

    permission = Permission.objects.get(
        content_type__app_label='kpi', codename='delete_submissions'
    )
    ThroughModel.objects.filter(permission=permission).exclude(
        user_id=AnonymousUser().pk
    ).delete()


def grant_object_level_perms(apps):
    """
    At the object level, grant `delete_submissions` to anyone who already has
    `change_submissions`
    """
    User = apps.get_model('auth', 'User')  # noqa
    Permission = apps.get_model('auth', 'Permission')  # noqa
    Asset = apps.get_model('kpi', 'Asset')  # noqa
    ObjectPermission = apps.get_model('kpi', 'ObjectPermission')  # noqa

    new_perm = Permission.objects.get(
        content_type__app_label='kpi', codename='delete_submissions'
    )
    old_perm = Permission.objects.get(codename='change_submissions')
    new_perm_objects = []
    for old_assign in ObjectPermission.objects.filter(
        permission=old_perm
    ).iterator():
        old_assign.pk = None
        old_assign.uid = None
        old_assign.permission = new_perm
        new_perm_objects.append(old_assign)
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
    Remove all object-level 'delete_submissions' permission assignments
    """
    Permission = apps.get_model('auth', 'Permission')  # noqa
    ObjectPermission = apps.get_model('kpi', 'ObjectPermission')  # noqa
    perm = Permission.objects.get(
        content_type__app_label='kpi', codename='delete_submissions'
    )
    ObjectPermission.objects.filter(permission=perm).delete()


def forwards_func(apps, schema_editor):
    sys.stderr.write(
        'Expanding `change_submissions` into `change_submissions` and '
        '`delete_submissions`. This may take several minutes on large '
        'databases...\n'
    )
    sys.stderr.flush()
    create_new_perms(apps)
    grant_model_level_perms(apps)
    grant_object_level_perms(apps)


def reverse_func(apps, schema_editor):
    # In testing, removal took only a small fraction of the time that it took
    # to create the assignments
    remove_object_level_perms(apps)
    remove_model_level_perms(apps)


class Migration(migrations.Migration):
    dependencies = [
        ('kpi', '0024_alter_jsonfield_to_jsonbfield'),
    ]

    operations = [
        migrations.RunPython(forwards_func, reverse_func),
    ]

