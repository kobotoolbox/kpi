from django.db import migrations
from django.db.migrations.recorder import MigrationRecorder
from django.db.models import Sum
from django.db.models import Value, F, DateField
from django.db.models.functions import Cast, Concat
from django.db.models.functions import ExtractYear, ExtractMonth
from django.utils import timezone

from kobo.apps.openrosa.apps.logger.utils import delete_null_user_daily_counters


def populate_missing_monthly_counters(apps, schema_editor):

    DailyXFormSubmissionCounter = apps.get_model('logger', 'DailyXFormSubmissionCounter')  # noqa
    MonthlyXFormSubmissionCounter = apps.get_model('logger', 'MonthlyXFormSubmissionCounter')  # noqa

    if not DailyXFormSubmissionCounter.objects.all().exists():
        return

    previous_migration = MigrationRecorder.Migration.objects.filter(
        app='logger', name='0029_populate_daily_xform_counters_for_year'
    ).first()

    # Delete monthly counters in the range if any (to avoid conflicts in bulk_create below)
    MonthlyXFormSubmissionCounter.objects.annotate(
        date=Cast(
            Concat(
                F('year'), Value('-'), F('month'), Value('-'), 1
            ),
            DateField(),
        )
    ).filter(date__gte=previous_migration.applied.date().replace(day=1)).delete()

    records = (
        DailyXFormSubmissionCounter.objects.filter(
            date__range=[
                previous_migration.applied.date().replace(day=1),
                timezone.now().date()
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
        batch_size=5000
    )


class Migration(migrations.Migration):

    dependencies = [
        ('logger', '0029_populate_daily_xform_counters_for_year'),
    ]

    operations = [
        migrations.RunPython(
            delete_null_user_daily_counters,
            migrations.RunPython.noop,
        ),
        migrations.RunPython(
            populate_missing_monthly_counters,
            migrations.RunPython.noop,
        ),
    ]
