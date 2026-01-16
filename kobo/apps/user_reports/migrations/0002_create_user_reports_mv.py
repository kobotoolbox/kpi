# flake8: noqa: E501

from django.db import migrations


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('user_reports', '0001_initial'),
        ('trackers', '0005_remove_year_and_month'),
        ('accounts_mfa', '0001_squashed_0004_alter_mfamethod_date_created_and_more'),
    ]

    operations = [
        migrations.RunPython(migrations.RunPython.noop, migrations.RunPython.noop),
    ]
