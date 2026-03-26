# flake8: noqa: E501
from django.db import migrations


class Migration(migrations.Migration):
    atomic = False
    dependencies = [('user_reports', '0003_fix_user_role_scopping')]

    operations = [
        migrations.RunPython(migrations.RunPython.noop, migrations.RunPython.noop),
    ]
