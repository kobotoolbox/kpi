from django.conf import settings
from django.db import connection, migrations


def create_settings__country_codes_index(apps, schema_editor):
    if settings.SKIP_HEAVY_MIGRATIONS:
        print(
            """
            !!! ATTENTION !!!
            If you have existing projects you need to run SQL query in PostgreSQL

               > CREATE INDEX CONCURRENTLY settings__country_codes_idx on kpi_asset USING GIN((settings->'country_codes'));"

            Otherwise, project views will perform very poorly.
            """
        )
    else:
        print(
            """
            This might take a while. If it is too slow, you may want to re-run the
            migration with SKIP_HEAVY_MIGRATIONS=True and run SQL query directly 
            in PostgreSQL.
            
            > CREATE INDEX CONCURRENTLY settings__country_codes_idx on kpi_asset USING GIN((settings->'country_codes'));"
            """
        )
        trigger_sql = (
            "CREATE INDEX settings__country_codes_idx on kpi_asset "
            "USING GIN((settings->'country_codes'));"
        )
        cursor = connection.cursor()
        cursor.execute(trigger_sql)


def drop_settings__country_codes_index(apps, schema_editor):
    trigger_sql = (
        "DROP INDEX settings__country_codes_idx;"
    )
    cursor = connection.cursor()
    cursor.execute(trigger_sql)


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0045_project_view_export_task'),
    ]

    operations = [
        migrations.RunPython(
            create_settings__country_codes_index,
            drop_settings__country_codes_index,
        ),
    ]
