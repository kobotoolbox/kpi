from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [('user_reports', '0006_fix_org_subscriptions_missing_metadata')]

    operations = [
        migrations.RunPython(migrations.RunPython.noop, migrations.RunPython.noop),
    ]
