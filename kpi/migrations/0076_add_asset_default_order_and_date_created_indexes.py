import django.contrib.postgres.indexes
from django.conf import settings
from django.contrib.postgres.operations import AddIndexConcurrently
from django.db import migrations, models

import kpi.utils.django_orm_helper


def get_indexes():
    return [
        django.contrib.postgres.indexes.BTreeIndex(
            kpi.utils.django_orm_helper.OrderCustomCharField(
                '_deployment_status', ['deployed', 'draft', 'archived']
            ),
            models.OrderBy(models.F('date_modified'), descending=True),
            models.F('id'),
            condition=models.Q(('asset_type', 'survey'), ('pending_delete', False)),
            name='asset_survey_default_order_idx',
        ),
        django.contrib.postgres.indexes.BTreeIndex(
            fields=['-date_created', 'id'], name='asset_date_created_id_idx'
        ),
    ]


def manually_create_indexes_instructions(apps, schema_editor):
    print(
        """
        !!! ATTENTION !!!
        If you have existing projects you need to run the SQL queries below in PostgreSQL directly:

           > CREATE INDEX CONCURRENTLY IF NOT EXISTS "asset_survey_default_order_idx" ON "kpi_asset" USING btree ((array_position(ARRAY['deployed', 'draft', 'archived']::varchar[], "_deployment_status")), "date_modified" DESC, "id") WHERE ("asset_type" = 'survey' AND NOT "pending_delete");
           > CREATE INDEX CONCURRENTLY IF NOT EXISTS "asset_date_created_id_idx" ON "kpi_asset" USING btree ("date_created" DESC, "id");

        Otherwise, project views will perform very poorly.
        """
    )


def manually_drop_indexes_instructions(apps, schema_editor):
    print(
        """
        !!! ATTENTION !!!
        Run the SQL queries below in PostgreSQL directly:

           > DROP INDEX CONCURRENTLY IF EXISTS "asset_survey_default_order_idx";
           > DROP INDEX CONCURRENTLY IF EXISTS "asset_date_created_id_idx";

        """
    )


class Migration(migrations.Migration):

    atomic = False

    dependencies = [
        ('kpi', '0075_remove_sync_storage_counters_task'),
    ]

    if settings.SKIP_HEAVY_MIGRATIONS:
        operations = [
            migrations.SeparateDatabaseAndState(
                database_operations=[
                    migrations.RunPython(
                        manually_create_indexes_instructions,
                        manually_drop_indexes_instructions,
                    )
                ],
                state_operations=[
                    migrations.AddIndex(model_name='asset', index=index)
                    for index in get_indexes()
                ],
            )
        ]
    else:
        operations = [
            AddIndexConcurrently(model_name='asset', index=index)
            for index in get_indexes()
        ]
