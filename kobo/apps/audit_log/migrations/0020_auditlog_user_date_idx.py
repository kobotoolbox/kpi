# flake8: noqa: E501
from django.conf import settings
from django.db import migrations, models


def manually_create_indexes_instructions(apps, schema_editor):
    print(
        """
        ⚠️ ATTENTION ⚠️
        Run the SQL queries below in PostgreSQL directly:

        --
        -- Create index audit_log_user_date_idx on field(s) user_id, -date_created of model auditlog
        --
        CREATE INDEX CONCURRENTLY audit_log_user_date_idx ON audit_log_auditlog (user_id, date_created DESC);
        """
    )


def manually_drop_indexes_instructions(apps, schema_editor):
    print(
        """
        ⚠️ ATTENTION ⚠️
        Run the SQL queries below in PostgreSQL directly:

        --
        -- Drop index audit_log_user_date_idx of model auditlog
        --
        DROP INDEX CONCURRENTLY IF EXISTS "audit_log_user_date_idx";
        """
    )


class Migration(migrations.Migration):
    """
    Records the composite index (user_id, date_created DESC) that was created
    directly in the database with CREATE INDEX CONCURRENTLY. SeparateDatabaseAndState
    updates Django's migration state without re-running the DDL.
    """

    dependencies = [
        ('audit_log', '0019_alter_auditlog_object_id'),
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
            migrations.AddIndex(
                model_name='auditlog',
                index=models.Index(
                    fields=['user_id', '-date_created'],
                    name='audit_log_user_date_idx',
                ),
            ),
        ]
