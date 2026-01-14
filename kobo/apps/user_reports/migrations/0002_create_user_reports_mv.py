# flake8: noqa: E501

from django.conf import settings
from django.db import migrations
from kobo.apps.user_reports.utils.sql_utils import (
    get_mv_sql, DROP_MV_SQL, CREATE_INDEXES_SQL, DROP_INDEXES_SQL
)

CREATE_MV_SQL = get_mv_sql(mode='global')

def manually_create_mv_instructions(apps, schema_editor):
    print(
        f"""
        ⚠️ ATTENTION ⚠️
        Run the SQL query below in PostgreSQL directly to create the materialized view:

        {CREATE_MV_SQL}

        Then run the SQL query below to create the indexes:

        {CREATE_INDEXES_SQL}

        """.replace(
            'CREATE UNIQUE INDEX', 'CREATE UNIQUE INDEX CONCURRENTLY'
        )
    )


def manually_drop_mv_instructions(apps, schema_editor):
    print(
        f"""
        ⚠️ ATTENTION ⚠️
        Run the SQL query below in PostgreSQL directly:

        {DROP_MV_SQL}

        """
    )


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('user_reports', '0001_initial'),
        ('trackers', '0005_remove_year_and_month'),
        ('accounts_mfa', '0001_squashed_0004_alter_mfamethod_date_created_and_more'),
    ]

    if settings.SKIP_HEAVY_MIGRATIONS:
        operations = [
            migrations.RunPython(
                manually_create_mv_instructions,
                manually_drop_mv_instructions,
            )
        ]
    else:
        operations = [
            migrations.RunSQL(
                sql=CREATE_MV_SQL,
                reverse_sql=DROP_MV_SQL,
            ),
            migrations.RunSQL(
                sql=CREATE_INDEXES_SQL,
                reverse_sql=DROP_INDEXES_SQL,
            ),
        ]
