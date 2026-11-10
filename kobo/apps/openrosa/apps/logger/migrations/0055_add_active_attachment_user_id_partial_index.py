# flake8: noqa: E501
from django.conf import settings
from django.db import migrations, models

INDEX_NAME = 'attachment_active_user_id_idx'


def manually_create_index_instructions(apps, schema_editor):
    print(f"""
        ⚠️ ATTENTION ⚠️
        Run the SQL query below in PostgreSQL directly:

        --
        -- Create partial index {INDEX_NAME} on logger_attachment
        --
        CREATE INDEX CONCURRENTLY "{INDEX_NAME}"
            ON "logger_attachment" ("user_id", "id")
            WHERE "delete_status" IS NULL AND "deleted_at" IS NULL;
        """)


def manually_drop_index_instructions(apps, schema_editor):
    print(f"""
        ⚠️ ATTENTION ⚠️
        Run the SQL query below in PostgreSQL directly:

        --
        -- Drop partial index {INDEX_NAME} on logger_attachment
        --
        DROP INDEX CONCURRENTLY IF EXISTS "{INDEX_NAME}";
        """)


class Migration(migrations.Migration):
    """
    Adds a partial index on (user_id, id) for active attachments.

    `auto_delete_excess_attachments` picks the oldest active attachments of a
    user in batches. Without this index, every batch reads and sorts all the
    rows of the user, millions for the largest accounts.
    """

    dependencies = [
        ('logger', '0054_add_null_root_uuid_partial_index'),
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
                model_name='attachment',
                index=models.Index(
                    fields=['user', 'id'],
                    name=INDEX_NAME,
                    condition=models.Q(
                        delete_status__isnull=True, deleted_at__isnull=True
                    ),
                ),
            ),
        ]
