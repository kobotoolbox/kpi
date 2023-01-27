from django.conf import settings
from django.core.management import call_command
from django.db import migrations


def standardize_fields(apps, schema_editor):
    if settings.SKIP_HEAVY_MIGRATIONS:
        print(
            """
            !!! ATTENTION !!!
            If you have existing projects you need to run this management command:

               > python manage.py standardize_searchable_fields

            Otherwise, search with query parser will not be accurate.
            """
        )
    else:
        print(
            """
            This might take a while. If it is too slow, you may want to re-run the
            migration with SKIP_HEAVY_MIGRATIONS=True and run the management command
            (standardize_searchable_fields) to standardize fields.
            """
        )
        call_command('standardize_searchable_fields')


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0043_asset_tracks_addl_columns'),
    ]

    # allow this command to be run backwards

    operations = [
        migrations.RunPython(
            standardize_fields,
            noop,
        ),
    ]
