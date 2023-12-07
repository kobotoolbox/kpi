import os
import re
from django.db import migrations

"""
Add any OIDC providers from the environment variables to the database. The upgrade to
django-allauth@0.57.0 removed code from /settings/base.py that parsed OIDC settings from
environment variables, so this migration is needed to avoid manually setting up OIDC
providers from the admin. Adapted from:
https://gitlab.com/glitchtip/glitchtip-backend/-/blob/master/users/migrations/0010_allauth_oidc_from_env_var.py?ref_type=heads
"""
def add_OIDC_settings_from_env(apps, schema_editor):
    SocialApp = apps.get_model('socialaccount', 'SocialApp')

    prefix = 'SOCIALACCOUNT_PROVIDERS_openid_connect_SERVERS_'
    pattern = re.compile(r'{prefix}\w+'.format(prefix=prefix))
    social_apps = {}

    for key, value in {
        key.replace(prefix, ''): val
        for key, val in os.environ.items()
        if pattern.match(key)
    }.items():
        number, setting = key.split('_', 1)
        if number in social_apps:
            social_apps[number][setting] = value
        else:
            social_apps[number] = {setting: value}
    social_apps = [x for x in social_apps.values()]

    for index, app in enumerate(social_apps):
        app_id = app.get('id')
        # the app needs a name to be editable in the admin - give it a default name if necessary
        app_name = app.get('name', f'OIDC {index}')
        app_settings = {'server_url': app.get('server_url', None)}
        # parse the tenant variable for microsoft OIDC providers - check for uppercase (old way) and lowercase (new way)
        if app_tenant := app.get('TENANT', app.get('tenant', None)):
            app_settings['tenant'] = app_tenant
        if app_id and app_settings['server_url'] and not (
            SocialApp.objects.filter(provider_id=app_id).exists()
        ):
            db_social_app, _ = SocialApp.objects.get_or_create(provider_id=app_id)
            db_social_app.provider = 'openid_connect'
            db_social_app.name = app_name
            db_social_app.client_id = app.get('APP_client_id', '')
            db_social_app.secret = app.get('APP_secret', '')
            db_social_app.key = app.get('APP_key', '')
            db_social_app.settings = app_settings
            db_social_app.save()


class Migration(migrations.Migration):
    dependencies = [
        ('socialaccount', '0005_socialtoken_nullable_app'),
    ]

    operations = [
        migrations.RunPython(
            code=add_OIDC_settings_from_env, reverse_code=migrations.RunPython.noop
        )
    ]
