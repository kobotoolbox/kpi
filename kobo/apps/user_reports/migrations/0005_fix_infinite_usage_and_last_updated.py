# flake8: noqa: E501
from django.db import migrations


class Migration(migrations.Migration):
    atomic = False
    dependencies = [('user_reports', '0004_fix_social_accounts_aggregation')]

    operations = [
        migrations.RunPython(migrations.RunPython.noop, migrations.RunPython.noop),
    ]
