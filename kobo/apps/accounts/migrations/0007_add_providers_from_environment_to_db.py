import os
import re
from django.db import migrations
from django.db.models import Q


def add_OIDC_settings_from_env(apps, schema_editor):
    """
    Add any OIDC providers from the environment variables to the database. The upgrade to
    django-allauth@0.57.0 removed code from /settings/base.py that parsed OIDC settings from
    environment variables, so this migration is needed to avoid manually setting up OIDC
    providers from the admin. Adapted from:
    https://gitlab.com/glitchtip/glitchtip-backend/-/blob/master/users/migrations/0010_allauth_oidc_from_env_var.py?ref_type=heads
    """
    SocialApp = apps.get_model('socialaccount', 'SocialApp')
    SocialAppCustomData = apps.get_model('accounts', 'SocialAppCustomData')

    oidc_prefix = 'SOCIALACCOUNT_PROVIDERS_openid_connect_SERVERS_'
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
        client_id = app.get('APP_client_id')

        # the app needs a name to be editable in the admin - give it a default name if necessary
        app_name = app.get('name', f'OIDC {index}')
        app_settings = {'server_url': app.get('server_url', None)}

        # parse the tenant variable for microsoft OIDC providers - check for uppercase (old way) and lowercase (new way)
        if app_tenant := app.get('TENANT', app.get('tenant', None)):
            app_settings['tenant'] = app_tenant

        if app_id and client_id and app_settings['server_url']:
            db_social_app = SocialApp.objects.filter(
                Q(provider=app_id) |
                Q(provider__iexact='openid_connect', provider_id=app_id) |
                Q(provider='', name__iexact=app_name)
            ).first()
            created = False
            if not db_social_app:
                db_social_app = SocialApp.objects.create()
                created = True
            db_social_app.settings = app_settings
            if not db_social_app.settings.get('previous_provider'):
                db_social_app.settings['previous_provider'] = app_id
            db_social_app.provider = 'openid_connect'
            db_social_app.provider_id = app_id
            # we don't want to overwrite the following settings if they're already defined
            # on the social app we grabbed
            db_social_app.name = db_social_app.name or app_name
            db_social_app.client_id = db_social_app.client_id or client_id
            db_social_app.secret = db_social_app.secret or app.get('APP_secret', '')
            db_social_app.key = db_social_app.key or app.get('APP_key', '')
            db_social_app.save()

            # if we had to create a social app, it was defined solely in env vars
            # hide the OIDC provider from the login page, since it was already hidden
            if created:
                SocialAppCustomData.objects.get_or_create(social_app=db_social_app)

    # copy the SOCIALACCOUNT_PROVIDERS_microsoft_TENANT variable to the `microsoft` provider, if both are present
    if ms_tenant := os.environ.get('SOCIALACCOUNT_PROVIDERS_microsoft_TENANT', None):
        # only look for MS social apps that *don't* have a lowercase 'tenant' in their per-app settings
        ms_app_query = SocialApp.objects.filter(
            provider='microsoft'
        ).exclude(
            settings__has_key='tenant'
        )
        for ms_app in ms_app_query.iterator():
            ms_app.settings['tenant'] = ms_tenant
            ms_app.save()


def revert_OIDC_provider_id(apps, schema_editor):
    SocialApp = apps.get_model('socialaccount', 'SocialApp')

    changed_apps = SocialApp.objects.filter(settings__has_key='previous_provider')
    for app in list(changed_apps):
        app.provider = app.settings['previous_provider']
        app.save()


class Migration(migrations.Migration):
    dependencies = [
        ('socialaccount', '0005_socialtoken_nullable_app'),
        ('accounts', '0006_alter_emailcontent_unique_together'),
    ]

    operations = [
        migrations.RunPython(
            code=add_OIDC_settings_from_env,
            reverse_code=revert_OIDC_provider_id,
        )
    ]
