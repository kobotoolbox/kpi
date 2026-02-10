from django.db import migrations


# The free tier option for older users is no longer offered,
# so the migration here has been removed
class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0050_add_indexes_to_import_and_export_tasks'),
    ]

    operations = [
        migrations.RunPython(
            migrations.RunPython.noop,
            migrations.RunPython.noop,
        )
    ]
