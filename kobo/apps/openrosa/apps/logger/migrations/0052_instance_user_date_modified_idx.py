# flake8: noqa: E501
from django.conf import settings
from django.db import migrations, models


def manually_create_indexes_instructions(apps, schema_editor):
    print(
        """
        ⚠️ ATTENTION ⚠️
        Run the SQL queries below in PostgreSQL directly:

        --
        -- Create index instance_user_date_mod_idx on field(s) user_id, -date_modified of model instance
        --
        CREATE INDEX CONCURRENTLY instance_user_date_mod_idx ON logger_instance (user_id, date_modified DESC);
        """
    )


def manually_drop_indexes_instructions(apps, schema_editor):
    print(
        """
        ⚠️ ATTENTION ⚠️
        Run the SQL queries below in PostgreSQL directly:

        --
        -- Drop index instance_user_date_mod_idx of model instance
        --
        DROP INDEX CONCURRENTLY IF EXISTS "instance_user_date_mod_idx";
        """
    )


class Migration(migrations.Migration):
    """
    Adds a composite index on (user_id, date_modified DESC) to speed up
    per-user activity lookups on logger_instance.
    """

    dependencies = [
        ('logger', '0051_alter_logger_models_options'),
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
                model_name='instance',
                index=models.Index(
                    fields=['user_id', '-date_modified'],
                    name='instance_user_date_mod_idx',
                ),
            ),
        ]
