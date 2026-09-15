from django.db import migrations, models


def purge_legacy_kml_exports(apps, schema_editor):
    Export = apps.get_model('viewer', 'Export')
    # Delete all legacy Kobocat KML rows so the DB stays clean
    Export.objects.filter(export_type='kml').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('viewer', '0006_parsedinstance_submitted_by'),
    ]

    operations = [
        migrations.RunPython(
            purge_legacy_kml_exports, reverse_code=migrations.RunPython.noop
        ),
        migrations.AlterField(
            model_name='export',
            name='export_type',
            field=models.CharField(
                choices=[('xls', 'Excel'), ('csv', 'CSV'), ('zip', 'ZIP')],
                default='xls',
                max_length=10,
            ),
        ),
    ]
