# coding: utf-8
import sys

from django.conf import settings
from django.contrib.auth.management import create_permissions
from django.contrib.auth.models import AnonymousUser
from django.db import migrations

from kpi.utils.database import use_db


def create_new_perms(apps):
    """
    The new `delete_data_xform` permission does not exist when running this
    migration for the first time. Django runs migrations in a transaction and
    new permissions are not created until after the transaction is completed.
    """
    for app_config in apps.get_app_configs():
        app_config.models_module = True
        create_permissions(
            app_config, apps=apps, verbosity=0, using=settings.OPENROSA_DB_ALIAS
        )
        app_config.models_module = None


def grant_model_level_perms(apps):
    """
    Grant `delete_submissions` permission to everyone at the model level
    """
    User = apps.get_model('kobo_auth', 'User')  # noqa
    Permission = apps.get_model('auth', 'Permission')  # noqa
    ThroughModel = User.user_permissions.through  # noqa

    with use_db(settings.OPENROSA_DB_ALIAS):
        permission = Permission.objects.get(
            content_type__app_label='logger', codename='delete_data_xform'
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
        # Django 1.8 does not support `ignore_conflicts=True`
        ThroughModel.objects.bulk_create(through_models)


def remove_model_level_perms(apps):
    """
    Remove all model-level 'delete_submissions' permission assignments
    """
    User = apps.get_model('kobo_auth', 'User')  # noqa
    Permission = apps.get_model('auth', 'Permission')  # noqa
    ThroughModel = User.user_permissions.through  # noqa

    with use_db(settings.OPENROSA_DB_ALIAS):
        permission = Permission.objects.get(
            content_type__app_label='logger', codename='delete_data_xform'
        )
        ThroughModel.objects.filter(permission=permission).exclude(
            user_id=AnonymousUser().pk
        ).delete()


def grant_object_level_perms(apps):
    """
    At the object level, grant `delete_submissions` to anyone who already has
    `change_submissions`
    """
    User = apps.get_model('kobo_auth', 'User')  # noqa
    Permission = apps.get_model('auth', 'Permission')  # noqa
    UserObjectPermission = apps.get_model('guardian', 'UserObjectPermission') # noqa

    with use_db(settings.OPENROSA_DB_ALIAS):
        new_perm = Permission.objects.get(
            content_type__app_label='logger', codename='delete_data_xform'
        )
        old_perm = Permission.objects.get(
            content_type__app_label='logger', codename='change_xform'
        )
        new_perm_objects = []
        for old_assign in UserObjectPermission.objects.filter(
            permission=old_perm
        ).iterator():
            old_assign.pk = None
            old_assign.permission = new_perm
            new_perm_objects.append(old_assign)
        sys.stderr.write(
            'Creating {} object-level permission assignments...\n'.format(
                len(new_perm_objects)
            )
        )
        sys.stderr.flush()
        # Django 1.8 does not support `ignore_conflicts=True`
        UserObjectPermission.objects.bulk_create(new_perm_objects)


def remove_object_level_perms(apps):
    """
    Remove all object-level 'delete_submissions' permission assignments
    """
    Permission = apps.get_model('auth', 'Permission')  # noqa
    UserObjectPermission = apps.get_model('guardian', 'UserObjectPermission')  # noqa
    with use_db(settings.OPENROSA_DB_ALIAS):
        perm = Permission.objects.get(
            content_type__app_label='logger', codename='delete_data_xform'
        )
        UserObjectPermission.objects.filter(permission=perm).delete()


def forwards_func(apps, schema_editor):
    sys.stderr.write(
        'Expanding `change_xform` into `change_xform` and '
        '`delete_data_xform`. This may take several minutes on large '
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
    """
    This migration has changed between KoBoCAT 1.0 and KoBoCAT 2.0.
    Permissions on Note model are altered in this migration in this branch.
    With Django 2.2 "view" permission is included by default.
    So `view_xform` and `view_notes` must be removed here because they were
    added by previous migrations in Django 1.8.
    It avoids an IntegrityError when Django tries to add `view_xform`|`view_notes`
    twice.
    """

    dependencies = [
        ('logger', '0014_attachment_add_media_file_size'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='xform',
            options={
                'ordering': ('id_string',),
                'verbose_name': 'XForm',
                'verbose_name_plural': 'XForms',
                'permissions': (
                    ('report_xform', 'Can make submissions to the form'),
                    ('move_xform', 'Can move form between projects'),
                    ('transfer_xform', 'Can transfer form ownership'),
                    ('validate_xform', 'Can validate submissions'),
                    ('delete_data_xform', 'Can delete submissions'),
                ),
            },
        ),
        migrations.AlterModelOptions(
            name='note',
            options={'permissions': ()},
        ),
        migrations.RunPython(forwards_func, reverse_func),
    ]
