from django.conf import settings
from django.db import migrations
from django.db.models.functions import ExtractYear, ExtractMonth
from django.utils import timezone


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('trackers', '0003_add_monthlynlpusagecounter_date'),
    ]

    def copy_month_and_year_to_date(apps, schema_editor):
        MonthlyNLPUsageCounter = apps.get_model("trackers", "MonthlyNLPUsageCounter")
        for usage_counter in MonthlyNLPUsageCounter.objects.only('year', 'month', 'date').all().iterator():
            # When converting monthly usage data to daily, set the day to the 1st of the month
            usage_counter.date = timezone.date(usage_counter.year, usage_counter.month, 1)
            usage_counter.save()

    def copy_date_to_month_and_year(apps, schema_editor):
        MonthlyNLPUsageCounter = apps.get_model("trackers", "MonthlyNLPUsageCounter")
        # When doing the operation in reverse we can just do an update
        MonthlyNLPUsageCounter.objects.only('year', 'month', 'date').update(
            year=ExtractYear('date'),
            month=ExtractMonth('date'),
        )

    def populate_usage_totals(apps, schema_editor):
        MonthlyNLPUsageCounter = apps.get_model("trackers", "MonthlyNLPUsageCounter")
        for usage_counter in MonthlyNLPUsageCounter.objects.only('year', 'month', 'date').all().iterator():
            total_asr_seconds, total_mt_characters = 0, 0
            for tracker, amount in usage_counter.counters.items():
                if tracker.endswith('asr_seconds'):
                    total_asr_seconds += amount
                if tracker.endswith('mt_characters'):
                    total_mt_characters += amount
            usage_counter.total_asr_seconds = total_asr_seconds
            usage_counter.total_asr_seconds = total_asr_seconds
            usage_counter.save()

    operations = [
        migrations.RunPython(
            copy_month_and_year_to_date,
            copy_date_to_month_and_year,
        ),
        migrations.RunPython(
            populate_usage_totals,
            migrations.RunPython.noop,
        ),
    ]
