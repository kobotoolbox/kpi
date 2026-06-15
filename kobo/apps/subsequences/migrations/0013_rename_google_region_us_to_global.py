import json
from django.db import migrations


def _read_constance_value(raw: str | None) -> str:
    if not raw:
        return ''
    try:
        return str(json.loads(raw))
    except (json.JSONDecodeError, TypeError):
        return str(raw)


def rename_us_to_global(apps, schema_editor):
    """
    Rename the legacy constance value 'US' to 'GLOBAL'.

    Migration 0012 introduced ASR_MT_GOOGLE_REGION and wrote 'US' as the
    default. The value is now 'GLOBAL' to reflect that non-EU servers use
    per-language global routing rather than a fixed US endpoint.
    EU deployments are unaffected.
    """
    try:
        Constance = apps.get_model('constance', 'Constance')
    except LookupError:
        return

    db_alias = schema_editor.connection.alias
    try:
        config = Constance.objects.using(db_alias).get(
            key='ASR_MT_GOOGLE_REGION'
        )
    except Constance.DoesNotExist:
        return

    if _read_constance_value(config.value).upper() == 'US':
        config.value = json.dumps('GLOBAL')
        config.save(update_fields=['value'])


def rename_global_to_us(apps, schema_editor):
    """
    Reverse: rename 'GLOBAL' back to 'US'
    """
    try:
        Constance = apps.get_model('constance', 'Constance')
    except LookupError:
        return

    db_alias = schema_editor.connection.alias
    try:
        config = Constance.objects.using(db_alias).get(
            key='ASR_MT_GOOGLE_REGION'
        )
    except Constance.DoesNotExist:
        return

    if _read_constance_value(config.value).upper() == 'GLOBAL':
        config.value = json.dumps('US')
        config.save(update_fields=['value'])


class Migration(migrations.Migration):

    dependencies = [
        ('subsequences', '0012_migrate_google_region_constance_key'),
        ('constance', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(
            rename_us_to_global,
            reverse_code=rename_global_to_us,
        ),
    ]
