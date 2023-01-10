from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0044_standardize_searchable_fields'),

    ]

    operations = [
        migrations.DeleteModel(
            name='OneTimeAuthenticationKey',
        ),
    ]
