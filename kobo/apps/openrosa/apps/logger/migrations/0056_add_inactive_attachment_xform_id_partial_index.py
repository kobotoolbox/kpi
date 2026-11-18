# flake8: noqa: E501
from django.conf import settings
from django.db import migrations, models

INDEX_NAME = 'attach_inactive_xform_id_idx'


def manually_create_index_instructions(apps, schema_editor):
    print(f"""
        ⚠️ ATTENTION ⚠️
        Run the SQL query below in PostgreSQL directly:

        --
        -- Create partial index {INDEX_NAME} on logger_attachment
        --
        CREATE INDEX CONCURRENTLY "{INDEX_NAME}"
            ON "logger_attachment" ("xform_id")
            WHERE "delete_status" IS NOT NULL;
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
    Adds a partial index on (xform_id) for inactive attachments.

    Storage counters can only drift on projects whose attachments left the
    active status (trashed, restored, soft deleted). The storage recount walks
    these projects through this index, jumping from one project to the next
    one, without reading the table.
    """

    dependencies = [
        ('logger', '0055_add_active_attachment_user_id_partial_index'),
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
                    fields=['xform'],
                    name=INDEX_NAME,
                    condition=models.Q(delete_status__isnull=False),
                ),
            ),
        ]
