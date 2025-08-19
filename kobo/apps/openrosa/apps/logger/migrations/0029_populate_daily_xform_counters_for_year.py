from django.db import migrations

# NOTE:
# This migrations was moved to 0037 in order to avoid conflict with the new
# field user_profile.submissions_suspended introduced on main migration 0017.
# This migration is obsolete and will be deleted in a future version.


class Migration(migrations.Migration):

    dependencies = [
        ('logger', '0028_add_user_to_daily_submission_counters'),
        ('main', '0012_add_validate_password_flag_to_profile'),
    ]

    # We don't do anything when migrating in reverse
    # Just set DAILY_COUNTER_MAX_DAYS back to 31 and counters will be auto-deleted
    operations = [
    ]
