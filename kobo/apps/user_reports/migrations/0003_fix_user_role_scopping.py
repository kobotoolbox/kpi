# flake8: noqa: E501
from django.db import migrations


class Migration(migrations.Migration):
    atomic = False
    dependencies = [('user_reports', '0002_create_user_reports_mv')]

    operations = [
        migrations.RunPython(migrations.RunPython.noop, migrations.RunPython.noop),
    ]
