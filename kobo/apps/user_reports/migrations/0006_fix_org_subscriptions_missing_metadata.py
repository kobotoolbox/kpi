from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [('user_reports', '0005_fix_infinite_usage_and_last_updated')]

    operations = [
        migrations.RunPython(migrations.RunPython.noop, migrations.RunPython.noop),
    ]
