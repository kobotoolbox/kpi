from datetime import datetime

from django.conf import settings
from django.db import migrations, models
from django.db.models.functions import ExtractYear, ExtractMonth


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('trackers', '0002_alter_monthlynlpusagecounter_user'),
    ]

    def copy_month_and_year_to_date(apps, schema_editor):
        MonthlyNLPUsageCounter = apps.get_model("trackers", "MonthlyNLPUsageCounter")
        for usage_counter in MonthlyNLPUsageCounter.objects.only('year', 'month', 'date').all().iterator():
            # When converting monthly usage data to daily, set the day to the 1st of the month
            usage_counter.date = datetime(usage_counter.year, usage_counter.month, 1)
            usage_counter.save()

    def copy_date_to_month_and_year(apps, schema_editor):
        MonthlyNLPUsageCounter = apps.get_model("trackers", "MonthlyNLPUsageCounter")
        # When doing the operation in reverse we can just do an update
        MonthlyNLPUsageCounter.objects.only('year', 'month', 'date').update(
            year=ExtractYear('date'),
            month=ExtractMonth('date'),
        )

    operations = [
        migrations.AddField(
            model_name='monthlynlpusagecounter',
            name='date',
            field=models.DateField(default=datetime.today()),
        ),
        migrations.RunPython(
            copy_month_and_year_to_date,
            copy_date_to_month_and_year,
        ),
        # This operation and the next are to prevent issues with null fields when migrating in reverse
        migrations.AlterField(
            model_name='monthlynlpusagecounter',
            name='year',
            field=models.IntegerField(default=0),
        ),
        migrations.AlterField(
            model_name='monthlynlpusagecounter',
            name='month',
            field=models.IntegerField(default=0),
        ),
        migrations.RemoveField(
            model_name='monthlynlpusagecounter',
            name='year',
        ),
        migrations.RemoveField(
            model_name='monthlynlpusagecounter',
            name='month',
        ),
    ]
