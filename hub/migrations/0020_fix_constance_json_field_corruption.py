import json

from constance import settings as constance_settings
from django.core.cache import caches
from django.db import migrations

from kpi.utils.log import logging

# These four constance keys use JsonSchemaFormField subclasses and must be
# stored as dict/list. A bug in clean() caused them to be stored as plain JSON
# strings instead. The constance 0003_drop_pickle migration preserved the
# corruption: a pickled str becomes a JSON-encoded string in the DB, so
# constance still reads back a str instead of a dict/list.
KEYS_TO_FIX = [
    'MFA_LOCALIZED_HELP_TEXT',
    'CUSTOM_PASSWORD_GUIDANCE_TEXT',
    'USER_METADATA_FIELDS',
    'PROJECT_METADATA_FIELDS',
]


def fix_constance_json_field_corruption(apps, schema_editor):
    """
    Repair constance keys whose stored value is a JSON-encoded string instead
    of a JSON object/array.

    Root cause: JsonSchemaFormField.clean() returned the raw input string
    instead of the parsed Python object. Constance encoded that string as JSON,
    so the DB ended up with e.g. '"{\\"default\\": ...}"' for a field that
    should contain '{"default": ...}'.

    After this migration, each affected key is stored as a proper JSON
    object/array, and the constance cache is invalidated so the corrected
    values are picked up immediately.
    """
    Constance = apps.get_model('constance', 'Constance')

    for key in KEYS_TO_FIX:
        try:
            record = Constance.objects.get(key=key)
        except Constance.DoesNotExist:
            # Never saved via admin — the default from CONSTANCE_CONFIG
            # (always a correct dict/list) will be used at runtime.
            continue

        try:
            outer = json.loads(record.value)
        except (json.JSONDecodeError, TypeError):
            logging.warning(
                'constance key %s: stored value is not valid JSON, skipping', key
            )
            continue

        if not isinstance(outer, str):
            # Already a dict, list, or lazy_json_serializable envelope — no fix needed.
            continue

        # The outer value is a string: it was double-encoded. The real data is
        # the result of parsing that string.
        try:
            inner = json.loads(outer)
        except json.JSONDecodeError:
            logging.warning(
                'constance key %s: inner value is not valid JSON, skipping', key
            )
            continue

        if not isinstance(inner, (dict, list)):
            logging.warning(
                'constance key %s: inner value is not a dict/list (%s), skipping',
                key,
                type(inner).__name__,
            )
            continue

        record.value = json.dumps(inner)
        record.save(update_fields=['value'])
        logging.info('constance key %s: repaired corrupted string value', key)

    # Invalidate the constance cache so the corrected DB values are served
    # immediately without waiting for cache expiry.
    try:
        cache_backend_name = constance_settings.DATABASE_CACHE_BACKEND
        if cache_backend_name:
            cache = caches[cache_backend_name]
            prefix = constance_settings.DATABASE_PREFIX
            keys = [f'{prefix}{key}' for key in KEYS_TO_FIX]
            cache.delete_many(keys)
    except Exception:
        # Never block a migration for a cache flush failure.
        pass


class Migration(migrations.Migration):

    dependencies = [
        ('hub', '0019_clear_constance_cache'),
        # Must run after 0003_drop_pickle so that previously pickled values are
        # already in JSON format before we inspect and repair them.
        ('constance', '0003_drop_pickle'),
    ]

    operations = [
        migrations.RunPython(
            fix_constance_json_field_corruption,
            migrations.RunPython.noop,
        ),
    ]
