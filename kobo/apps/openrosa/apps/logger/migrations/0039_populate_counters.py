from django.conf import settings
from django.core.management import call_command
from django.db import migrations
from django.db.migrations.recorder import MigrationRecorder
from django.db.models import DateField, F, Sum, Value
from django.db.models.functions import Cast, Concat, ExtractMonth, ExtractYear
from django.utils import timezone

from kobo.apps.openrosa.apps.logger.utils.counters import (
    delete_null_user_daily_counters,
)


def populate_missing_monthly_counters(apps, schema_editor):

    DailyXFormSubmissionCounter = apps.get_model(
        'logger', 'DailyXFormSubmissionCounter'
    )  # noqa
    MonthlyXFormSubmissionCounter = apps.get_model(
        'logger', 'MonthlyXFormSubmissionCounter'
    )  # noqa

    if not DailyXFormSubmissionCounter.objects.all().exists():
        return

    previous_migration = MigrationRecorder.Migration.objects.filter(
        app='logger', name='0029_populate_daily_xform_counters_for_year'
    ).first()

    # Delete monthly counters in the range if any
    # (to avoid conflicts in bulk_create below)
    MonthlyXFormSubmissionCounter.objects.annotate(
        date=Cast(
            Concat(F('year'), Value('-'), F('month'), Value('-'), 1),
            DateField(),
        )
    ).filter(date__gte=previous_migration.applied.date().replace(day=1)).delete()

    records = (
        DailyXFormSubmissionCounter.objects.filter(
            date__range=[
                previous_migration.applied.date().replace(day=1),
                timezone.now().date(),
            ]
        )
        .annotate(year=ExtractYear('date'), month=ExtractMonth('date'))
        .values('user_id', 'xform_id', 'month', 'year')
        .annotate(total=Sum('counter'))
    ).order_by('year', 'month', 'user_id')

    # Do not use `ignore_conflicts=True` to ensure all counters are successfully
    # create.
    # TODO use `update_conflicts` with Django 4.2 and avoid `.delete()` above
    MonthlyXFormSubmissionCounter.objects.bulk_create(
        [
            MonthlyXFormSubmissionCounter(
                year=r['year'],
                month=r['month'],
                user_id=r['user_id'],
                xform_id=r['xform_id'],
                counter=r['total'],
            )
            for r in records
        ],
        batch_size=5000,
    )


def populate_daily_counts_for_year(apps, schema_editor):
    if settings.SKIP_HEAVY_MIGRATIONS:
        print(
            """
            !!! ATTENTION !!!
            If you have existing projects, you need to run this management command:

               > python manage.py populate_submission_counters -f --skip-monthly

            Until you do, total usage counts from the KPI endpoints
            /api/v2/service_usage and /api/v2/asset_usage will be incorrect
            """
        )
    else:
        print(
            """
            This might take a while. If it is too slow, you may want to re-run the
            migration with SKIP_HEAVY_MIGRATIONS=True and run the following management
            command:

                > python manage.py populate_submission_counters -f --skip-monthly
            """
        )
        call_command('populate_submission_counters', force=True, skip_monthly=True)


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('logger', '0038_add_mongo_uuid_field_to_xform'),
        ('main', '0017_userprofile_submissions_suspended'),
    ]

    # We don't do anything when migrating in reverse
    # Just set DAILY_COUNTER_MAX_DAYS back to 31 and counters will be auto-deleted
    operations = [
        migrations.RunPython(
            populate_daily_counts_for_year,
            migrations.RunPython.noop,
        ),
        migrations.RunPython(
            delete_null_user_daily_counters,
            migrations.RunPython.noop,
        ),
    ]

    replaces = [
        ('logger', '0029_populate_daily_xform_counters_for_year'),
        ('logger', '0030_backfill_lost_monthly_counters'),
        ('logger', '0031_remove_null_user_daily_counters'),
    ]
