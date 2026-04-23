from django.db import migrations


def _migrate_constance_key(apps, db_alias, from_key, to_key, default_value=None):
    try:
        Constance = apps.get_model('constance', 'Constance')
    except LookupError:
        return

    try:
        source_config = Constance.objects.using(db_alias).get(key=from_key)

        Constance.objects.using(db_alias).update_or_create(
            key=to_key, defaults={'value': source_config.value}
        )

        source_config.delete()
        return
    except Constance.DoesNotExist:
        pass

    # If source is missing, set default only when destination does not exist.
    if default_value is not None:
        Constance.objects.using(db_alias).get_or_create(
            key=to_key, defaults={'value': default_value}
        )


def migrate_google_region(apps, schema_editor):
    _migrate_constance_key(
        apps,
        schema_editor.connection.alias,
        from_key='ASR_MT_GOOGLE_TRANSLATION_LOCATION',
        to_key='ASR_MT_GOOGLE_REGION',
        default_value='us-central1',
    )


def reverse_migrate_google_region(apps, schema_editor):
    _migrate_constance_key(
        apps,
        schema_editor.connection.alias,
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
