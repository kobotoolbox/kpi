from constance import settings as constance_settings
from django.db import migrations
from django.core.cache import caches


def clear_constance_cache(apps, schema_editor):
    """
    Clears all constance-related keys from the isolated constance cache backend.

    Starting with this release, constance uses a dedicated cache backend
    ('constance') with KEY_PREFIX='constance_4x' instead of the shared
    'default' backend. This isolates constance cache keys from old workers
    during rolling deploys, preventing cross-format deserialization errors
    between constance 3.x and 4.x serialization formats.

    This migration wipes the new namespace so that constance repopulates from
    the database on first access, guaranteeing no stale data from a previous
    deployment is served.
    """
    try:
        cache_backend_name = constance_settings.DATABASE_CACHE_BACKEND
        if not cache_backend_name:
            return

        cache = caches[cache_backend_name]
        prefix = constance_settings.DATABASE_PREFIX
        keys = [f'{prefix}{key}' for key in constance_settings.CONFIG]
        # 'autofilled' is a sentinel Constance sets after bulk-loading all keys
        # from the DB into cache. Without clearing it, Constance would skip the
        # autofill and never repopulate the individual keys we just deleted.
        keys.append(f'{prefix}autofilled')
        cache.delete_many(keys)
    except Exception:
        # Never block a migration for a cache flush failure.
        pass


class Migration(migrations.Migration):

    dependencies = [
        ('hub', '0018_merge_user_tracker_and_extrauserdetails_changes'),
    ]

    operations = [
        migrations.RunPython(clear_constance_cache, migrations.RunPython.noop),
    ]
