import json
from django.db import migrations


def _read_constance_value(raw: str | None) -> str:
    if not raw:
        return ''
    try:
        return str(json.loads(raw))
    except (json.JSONDecodeError, TypeError):
        return str(raw)


def _get_constance_config(apps, schema_editor):
    try:
        Constance = apps.get_model('constance', 'Constance')
    except LookupError:
        return None
    try:
        return Constance.objects.using(schema_editor.connection.alias).get(
            key='ASR_MT_GOOGLE_REGION'
        )
    except Constance.DoesNotExist:
        return None


def normalise_to_lowercase(apps, schema_editor):
    """
    Normalise legacy uppercase region slugs to lowercase

    Migration 0012 wrote 'US' as the default and 'EU' for EU deployments.
    Both are now lowercase ('global' and 'eu') to match the updated slug
    convention. Leaving 'EU' uppercase would cause the Django admin Constance
    form to render the wrong selected option, risking a silent switch from EU
    to GLOBAL data residency on save.
    """
    config = _get_constance_config(apps, schema_editor)
    if config is None:
        return

    RENAMES = {'us': 'global', 'eu': 'eu'}
    current = _read_constance_value(config.value).lower()
    if current in RENAMES and config.value != json.dumps(RENAMES[current]):
        config.value = json.dumps(RENAMES[current])
        config.save(update_fields=['value'])


def revert_to_uppercase(apps, schema_editor):
    """
    Reverse: restore uppercase slugs written by migration 0012
    """
    config = _get_constance_config(apps, schema_editor)
    if config is None:
        return

    RENAMES = {'global': 'US', 'eu': 'EU'}
    current = _read_constance_value(config.value).lower()
    if current in RENAMES:
        config.value = json.dumps(RENAMES[current])
        config.save(update_fields=['value'])


class Migration(migrations.Migration):

    dependencies = [
        ('subsequences', '0012_migrate_google_region_constance_key'),
        ('constance', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(
            normalise_to_lowercase,
            reverse_code=revert_to_uppercase,
        ),
    ]
