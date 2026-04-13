from django.db import migrations


def _migrate_constance_key(apps, from_key, to_key, default_value=None):
    try:
        Constance = apps.get_model('constance', 'Constance')
    except LookupError:
        return

    try:
        source_config = Constance.objects.get(key=from_key)

        Constance.objects.update_or_create(
            key=to_key, defaults={'value': source_config.value}
        )

        source_config.delete()
        return
    except Constance.DoesNotExist:
        pass

    # If the key does not exist, set the default value
    if default_value is not None:
        try:
            from constance import config
        except ImportError:
            return

        try:
            setattr(config, to_key, default_value)
        except AttributeError:
            # Bypass safely if the key does not exist
            pass


def migrate_google_region(apps, schema_editor):
    _migrate_constance_key(
        apps,
        from_key='ASR_MT_GOOGLE_TRANSLATION_LOCATION',
        to_key='ASR_MT_GOOGLE_REGION',
        default_value='us-central1',
    )


def reverse_migrate_google_region(apps, schema_editor):
    _migrate_constance_key(
        apps,
        from_key='ASR_MT_GOOGLE_REGION',
        to_key='ASR_MT_GOOGLE_TRANSLATION_LOCATION',
        default_value='global',
    )


class Migration(migrations.Migration):

    dependencies = [
        ('subsequences', '0009_update_automatic_qual'),
        ('constance', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(
            migrate_google_region, reverse_code=reverse_migrate_google_region
        ),
    ]
