import json
from django.db import migrations
from constance.codecs import loads, dumps


def _read_constance_value(raw: str | None) -> str:
    """
    Safely decode a value read directly from the Constance DB column

    Constance stores all values as plain JSON strings in the database. Reading
    the ORM field directly gives the raw JSON, so we must decode it before
    doing any string comparisons.
    """
    if not raw:
        return ''
    try:
        return str(json.loads(raw))
    except (json.JSONDecodeError, TypeError):
        return str(raw)


def _get_region_from_legacy_location(raw_db_value: str | None) -> str:
    """
    Convert an old ASR_MT_GOOGLE_TRANSLATION_LOCATION DB value to the new
    two-value region format
    """
    location = _read_constance_value(raw_db_value).lower()
    if location == 'eu' or location.startswith('europe-'):
        return 'EU'
    return 'US'


def migrate_google_region(apps, schema_editor):
    try:
        Constance = apps.get_model('constance', 'Constance')
    except LookupError:
        return

    db_alias = schema_editor.connection.alias

    try:
        source_config = Constance.objects.using(db_alias).get(
            key='ASR_MT_GOOGLE_TRANSLATION_LOCATION'
        )
    except Constance.DoesNotExist:
        Constance.objects.using(db_alias).get_or_create(
            key='ASR_MT_GOOGLE_REGION',
            defaults={'value': json.dumps('US')},
        )
        return

    new_region = _get_region_from_legacy_location(source_config.value)
    Constance.objects.using(db_alias).update_or_create(
        key='ASR_MT_GOOGLE_REGION',
        defaults={'value': json.dumps(new_region)},
    )
    source_config.delete()


def reverse_migrate_google_region(apps, schema_editor):
    try:
        Constance = apps.get_model('constance', 'Constance')
    except LookupError:
        return

    db_alias = schema_editor.connection.alias

    try:
        source_config = Constance.objects.using(db_alias).get(
            key='ASR_MT_GOOGLE_REGION'
        )
    except Constance.DoesNotExist:
        Constance.objects.using(db_alias).get_or_create(
            key='ASR_MT_GOOGLE_TRANSLATION_LOCATION',
            defaults={'value': json.dumps('us-central1')},
        )
        return

    region = _read_constance_value(source_config.value).upper()
    old_location = 'europe-west1' if region == 'EU' else 'us-central1'
    Constance.objects.using(db_alias).update_or_create(
        key='ASR_MT_GOOGLE_TRANSLATION_LOCATION',
        defaults={'value': json.dumps(old_location)},
    )
    source_config.delete()


class Migration(migrations.Migration):

    dependencies = [
        ('subsequences', '0011_add_cancelled_by_field_to_subsequencebulkaction'),
        ('constance', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(
            migrate_google_region,
            reverse_code=reverse_migrate_google_region,
        ),
    ]
