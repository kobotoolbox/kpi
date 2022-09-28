from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0040_synchronous_export'),
    ]

    operations = [
        migrations.DeleteModel(
            name='OneTimeAuthenticationKey',
        ),
    ]
