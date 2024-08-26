from django.conf import settings
from django.db import migrations

from kobo.apps.openrosa.apps.logger.utils import delete_null_user_daily_counters


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('logger', '0030_backfill_lost_monthly_counters'),
    ]

    operations = [
        migrations.RunPython(
            delete_null_user_daily_counters,
            migrations.RunPython.noop,
        ),
    ]
