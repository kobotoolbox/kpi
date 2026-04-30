from constance import settings as constance_settings
from django.db import migrations
from django.core.cache import caches


def clear_constance_cache(apps, schema_editor):
    """
    Clears all constance-related keys from the Django cache.

    When upgrading from a version that used a custom constance backend with a
    broken get() method, the cache (Redis) may contain raw JSON strings instead
    of decoded Python objects. This migration forces a full cache invalidation
    so that constance repopulates from the database with correctly decoded
    values on the next access.
    """
    try:
        cache_backend_name = constance_settings.DATABASE_CACHE_BACKEND
        if not cache_backend_name:
            return

        cache = caches[cache_backend_name]
        prefix = constance_settings.DATABASE_PREFIX
        keys = [f'{prefix}{key}' for key in constance_settings.CONFIG]
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
