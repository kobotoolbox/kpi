# Generated by Django 4.2.15 on 2024-09-11 19:33

from django.conf import settings
from django.db import migrations, models


def manually_create_indexes_instructions(apps, schema_editor):
    print(
        """
        !!! ATTENTION !!!
        If you have existing projects you need to run the SQL queries below in PostgreSQL directly:

           > CREATE INDEX CONCURRENTLY "logger_xform_kpi_asset_uid_e5e6b08d" ON "logger_xform" ("kpi_asset_uid");
           > CREATE INDEX CONCURRENTLY "logger_xform_kpi_asset_uid_e5e6b08d_like" ON "logger_xform" ("kpi_asset_uid" varchar_pattern_ops);


        Otherwise, project views will perform very poorly.
        """
    )


def manually_drop_indexes_instructions(apps, schema_editor):
    print(
        """
        !!! ATTENTION !!!
        Run the SQL queries below in PostgreSQL directly:

           > DROP INDEX IF EXISTS "logger_xform_kpi_asset_uid_e5e6b08d_like";
           > DROP INDEX IF EXISTS "logger_xform_kpi_asset_uid_e5e6b08d";

        """
    )


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('logger', '0034_set_require_auth_at_project_level'),
    ]

    if settings.SKIP_HEAVY_MIGRATIONS:
        operations = [
            migrations.RunPython(
                manually_create_indexes_instructions,
                manually_drop_indexes_instructions,
            )
        ]
    else:
        operations = [
            migrations.AlterField(
                model_name='xform',
                name='kpi_asset_uid',
                field=models.CharField(db_index=True, max_length=32, null=True),
            ),
        ]