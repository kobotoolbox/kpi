from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0047_asset_date_deployed'),

    ]

    operations = [
        migrations.DeleteModel(
            name='OneTimeAuthenticationKey',
        ),
    ]
