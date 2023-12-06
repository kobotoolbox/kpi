import os
import re
from django.db import migrations


def add_OIDC_settings_from_env(apps, schema_editor):
    SocialApp = apps.get_model('socialaccount', 'SocialApp')

    oidc_prefix = "SOCIALACCOUNT_PROVIDERS_openid_connect_SERVERS_"
    oidc_pattern = re.compile(r'{prefix}\w+'.format(prefix=oidc_prefix))
    oidc_apps = {}
    for key, value in {
        key.replace(oidc_prefix, ''): val
        for key, val in os.environ.items()
        if oidc_pattern.match(key)
    }.items():
        number, setting = key.split('_', 1)
        if number in oidc_apps:
            oidc_apps[number][setting] = value
        else:
            oidc_apps[number] = {setting: value}
    oidc_apps = [x for x in oidc_apps.values()]

    for index, app in enumerate(oidc_apps):
        app_id = app.get('id')
        app_name = app.get('name', f'OIDC {index}')
        app_settings = {'server_url': app.get('server_url', None)}
        if app_tenant := app.get('TENANT', None):
            app_settings['tenant'] = app_tenant
        if app_id and app_settings['server_url']:
            db_social_app, created = SocialApp.objects.get_or_create(provider=app_id)
            if created or not db_social_app.settings:
                db_social_app.provider = 'openid_connect'
                db_social_app.provider_id = app_id
                db_social_app.name = app_name
                db_social_app.client_id = app.get('APP_client_id', '')
                db_social_app.secret = app.get('APP_secret', '')
                db_social_app.key = app.get('APP_key', '')
                db_social_app.settings = app_settings
                db_social_app.save()
            if not db_social_app:
                pass


class Migration(migrations.Migration):
    dependencies = [
        ('socialaccount', '0005_socialtoken_nullable_app'),
    ]

    operations = [
        migrations.RunPython(
            code=add_OIDC_settings_from_env, reverse_code=migrations.RunPython.noop
        )
    ]
