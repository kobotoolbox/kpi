from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('trackers', '0004_populate_date_and_totals'),
    ]

    operations = [
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
        migrations.RenameModel(
            old_name='monthlynlpusagecounter',
            new_name='nlpusagecounter',
        ),
    ]
