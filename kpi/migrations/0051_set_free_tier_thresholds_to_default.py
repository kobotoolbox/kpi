from constance import config
from django.db import migrations

from kobo.apps.stripe.constants import FREE_TIER_NO_THRESHOLDS
from kpi.utils.json import LazyJSONSerializable


def reset_free_tier_thresholds(apps, schema_editor):
    # The constance defaults for FREE_TIER_THRESHOLDS changed, so we set existing config to the new default value
    setattr(config, 'FREE_TIER_THRESHOLDS', LazyJSONSerializable(FREE_TIER_NO_THRESHOLDS))


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0050_add_indexes_to_import_and_export_tasks'),
    ]

    operations = [
        migrations.RunPython(
            reset_free_tier_thresholds,
            migrations.RunPython.noop,
        )
    ]
