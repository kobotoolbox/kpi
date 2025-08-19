from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('logger', '0028_add_user_to_daily_submission_counters'),
    ]

    operations = [
        migrations.AlterField(
            model_name='dailyxformsubmissioncounter',
            name='user',
            field=models.ForeignKey(settings.AUTH_USER_MODEL, related_name='daily_users', null=False, on_delete=models.CASCADE),
        ),
    ]
