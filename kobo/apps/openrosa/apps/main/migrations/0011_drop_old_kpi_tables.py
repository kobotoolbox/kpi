# Generated by Django 3.2.15 on 2023-03-22 14:05

from django.conf import settings
from django.db import connections, migrations

KPI_TABLES = [
    'constance_config',
    'kpi_objectpermission',
    'kpi_assetsnapshot',
    'kpi_assetfile',
    'kpi_assetversion',
    'kpi_assetuserpartialpermission',
    'hook_hooklog',
    'hook_hook',
    'kpi_asset',
    'kpi_asset_old',
    'kpi_usercollectionsubscription',
    'kpi_collection',
    'kpi_importtask',
    'kpi_authorizedapplication',
    'kpi_taguid',
    'kpi_onetimeauthenticationkey',
    'kpi_exporttask',
    'hub_sitewidemessage',
    'hub_configurationfile',
    'hub_extrauserdetail',
    'hub_perusersetting',
    'hub_formbuilderpreference',
    'external_integrations_corsmodel',
    'help_inappmessageuserinteractions',
    'help_inappmessagefile',
    'help_inappmessage',
]

DEPRECATED_TABLES = [
    'djcelery_periodictask',
    'djcelery_crontabschedule',
    'djcelery_intervalschedule',
    'djcelery_periodictasks',
    'djcelery_taskstate',
    'djcelery_workerstate',
    'celery_tasksetmeta',
    'celery_taskmeta',
    'koboform_surveydraft',
    'koboform_surveypreview',
    'registration_supervisedregistrationprofile',
    'registration_registrationprofile',
    'south_migrationhistory',
    'stats_statscount',
]


def get_operations():
    if settings.TESTING or settings.SKIP_HEAVY_MIGRATIONS:
        # Skip this migration if running in test environment or because we want
        # to voluntarily skip it.
        return []

    tables = DEPRECATED_TABLES + KPI_TABLES
    operations = []

    # SQL query to retrieve every constraint and foreign key of a specific table
    sql = """
        SELECT con.conname
           FROM pg_catalog.pg_constraint con
                INNER JOIN pg_catalog.pg_class rel
                           ON rel.oid = con.conrelid
                INNER JOIN pg_catalog.pg_namespace nsp
                           ON nsp.oid = con.connamespace
           WHERE nsp.nspname = 'public'
                 AND rel.relname = %s;
    """
    with connections[settings.OPENROSA_DB_ALIAS].cursor() as cursor:
        drop_table_queries = []
        # Loop on every table needed to be deleted:
        # 1) Remove every constraint/FK of the table first
        # 2) Drop the table
        for table in tables:
            cursor.execute(sql, [table])
            drop_index_queries = []
            for row in cursor.fetchall():
                if not row[0].endswith('_pkey'):
                    drop_index_queries.append(
                        f'ALTER TABLE public.{table} DROP CONSTRAINT {row[0]};'
                    )
            drop_table_queries.append(f'DROP TABLE IF EXISTS {table};')
            operations.append(
                migrations.RunSQL(
                    sql=''.join(drop_index_queries),
                    reverse_sql=migrations.RunSQL.noop,
                )
            )

        operations.append(
            migrations.RunSQL(
                sql=''.join(drop_table_queries),
                reverse_sql=migrations.RunSQL.noop,
            )
        )

    return operations


def print_migration_warning(apps, schema_editor):
    if settings.TESTING or settings.SKIP_HEAVY_MIGRATIONS:
        return
    print(
        """
        This migration might take a while. If it is too slow, you may want to
        re-run migrations with SKIP_HEAVY_MIGRATIONS=True and apply this one
        manually from the django shell.
        """
    )


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0010_userprofile_metadata_jsonfield'),
    ]

    operations = [migrations.RunPython(print_migration_warning), *get_operations()]
