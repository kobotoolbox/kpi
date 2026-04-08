from django.db import migrations


def _migrate_constance_key(apps, from_key, to_key):
    try:
        Constance = apps.get_model('constance', 'Constance')
    except LookupError:
        return

    try:
        source_config = Constance.objects.get(key=from_key)
        
        _, _ = Constance.objects.get_or_create(
            key=to_key,
            defaults={'value': source_config.value}
        )
        
        source_config.delete()
        
    except Constance.DoesNotExist:
        pass


def migrate_google_region(apps, schema_editor):
    _migrate_constance_key(
        apps,
        from_key='ASR_MT_GOOGLE_TRANSLATION_LOCATION',
        to_key='ASR_MT_GOOGLE_REGION'
    )


def reverse_migrate_google_region(apps, schema_editor):
    _migrate_constance_key(
        apps,
        from_key='ASR_MT_GOOGLE_REGION',
        to_key='ASR_MT_GOOGLE_TRANSLATION_LOCATION'
    )


class Migration(migrations.Migration):

    dependencies = [
        ('subsequences', '0009_update_automatic_qual'),
        ('constance', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(
            migrate_google_region,
            reverse_code=reverse_migrate_google_region
        ),
    ]
