from datetime import datetime

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('trackers', '0002_alter_monthlynlpusagecounter_user'),
    ]

    operations = [
        migrations.AddField(
            model_name='monthlynlpusagecounter',
            name='date',
            field=models.DateField(default=datetime.today()),
        ),
        migrations.AddField(
            model_name='monthlynlpusagecounter',
            name='total_asr_seconds',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='monthlynlpusagecounter',
            name='total_mt_characters',
            field=models.PositiveIntegerField(default=0),
        ),
    ]
