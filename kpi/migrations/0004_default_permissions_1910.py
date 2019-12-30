# coding: utf-8
from django.db import models, migrations
from django.contrib.auth import get_user_model
from django.contrib.auth.management import create_permissions
from kpi.utils.permissions import grant_all_model_level_perms


def default_permissions_to_existing_users(apps, schema_editor):
    # The permissions objects might not have been created yet. See
    # https://code.djangoproject.com/ticket/23422. This is a workaround.
    for app_config in apps.get_app_configs():
        old_models_module = app_config.models_module
        if app_config.models_module is None:
            app_config.models_module = True # HACK HACK HACK
        create_permissions(
            app_config=app_config,
            verbosity=0,
            interactive=False,
            using=schema_editor.connection.alias
        )
        app_config.models_module = old_models_module
    # End workaround.
    Asset = apps.get_model('kpi', 'Asset')
    Collection = apps.get_model('kpi', 'Collection')
    Permission = apps.get_model('auth', 'Permission')
    forbidden_user_model = get_user_model()
    # Get the frozen User model
    User = apps.get_model(
        forbidden_user_model._meta.app_label,
        forbidden_user_model._meta.model_name
    )
    db_alias = schema_editor.connection.alias
    existing_users = User.objects.using(db_alias).all()
    existing_users_count = existing_users.count()
    permissions_manager = Permission.objects.using(db_alias)
    counter = 0
    last_progress_message_length = 0
    for user in existing_users:
        grant_all_model_level_perms(
            user, (Asset, Collection), permissions_manager)
        counter += 1
        sys.stdout.write('\b' * last_progress_message_length)
        progress_message = ' {}/{} users...'.format(
            counter, existing_users_count)
        last_progress_message_length = len(progress_message)
        sys.stdout.write(progress_message)
        sys.stdout.flush()

def do_nothing(*args, **kwargs):
    ''' A no-op for reverse migration. Django 1.8 has RunPython.noop(), but
    1.7 does not. '''
    pass

class Migration(migrations.Migration):

    dependencies = [
        # Not true, but if we specify '0001_initial', migrate will raise a
        # CommandError: Conflicting migrations detected
        ('kpi', '0003_assetsnapshot'),
        ('auth', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(
            default_permissions_to_existing_users,
            reverse_code=do_nothing
        )
    ]
