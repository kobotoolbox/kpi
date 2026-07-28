# flake8: noqa: E501
from django.conf import settings
from django.db import migrations, models

INDEX_NAME = 'xform_null_root_uuid_idx'


def manually_create_index_instructions(apps, schema_editor):
    print(
        f"""
        ⚠️ ATTENTION ⚠️
        Run the SQL query below in PostgreSQL directly:

        --
        -- Create partial index {INDEX_NAME} on logger_instance
        --
        CREATE INDEX CONCURRENTLY "xform_null_root_uuid_idx"
            ON "logger_instance" ("xform_id")
            WHERE "root_uuid" IS NULL;
        """
    )


def manually_drop_index_instructions(apps, schema_editor):
    print(
        f"""
        ⚠️ ATTENTION ⚠️
        Run the SQL query below in PostgreSQL directly:

        --
        -- Drop partial index {INDEX_NAME} on logger_instance
        --
        DROP INDEX CONCURRENTLY IF EXISTS "{INDEX_NAME}";
        """
    )


class Migration(migrations.Migration):
    """
    Adds a partial index on (xform_id) WHERE root_uuid IS NULL.

    LRM 0027 and the clean_duplicated_submissions_root_uuid command rely on it
    to find instances still missing a root_uuid without scanning every NULL
    row in the table.
    """

    dependencies = [
        ('logger', '0053_merge_conflicting_0052'),
    ]

    if settings.SKIP_HEAVY_MIGRATIONS:
        operations = [
            migrations.RunPython(
                manually_create_index_instructions,
                manually_drop_index_instructions,
            )
        ]
    else:
        operations = [
            migrations.AddIndex(
                model_name='instance',
                index=models.Index(
                    fields=['xform'],
                    name=INDEX_NAME,
                    condition=models.Q(root_uuid__isnull=True),
                ),
            ),
        ]
