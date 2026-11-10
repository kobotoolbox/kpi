from django.conf import settings
from django.db import migrations, models


def manually_create_indexes_instructions(apps, schema_editor):
    print("""
        ⚠️ ATTENTION ⚠️
        Run the SQL query below in PostgreSQL directly:

        CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
        "unique_pending_org_ownership_transfer" ON
        "project_ownership_invite" ("sender_id")
        WHERE "invite_type" = 'org-ownership-transfer' AND "status" = 'pending';
    """)


def manually_drop_indexes_instructions(apps, schema_editor):
    print("""
        ⚠️ ATTENTION ⚠️
        Run the SQL query below in PostgreSQL directly:

        DROP INDEX CONCURRENTLY IF EXISTS "unique_pending_org_ownership_transfer";
    """)


def get_conditional_operations():
    state_ops = [
        migrations.AddConstraint(
            model_name='invite',
            constraint=models.UniqueConstraint(
                condition=models.Q(
                    ('invite_type', 'org-ownership-transfer'),
                    ('status', 'pending'),
                ),
                fields=('sender',),
                name='unique_pending_org_ownership_transfer',
            ),
        ),
    ]

    if getattr(settings, 'SKIP_HEAVY_MIGRATIONS', False):
        return [
            migrations.SeparateDatabaseAndState(
                database_operations=[
                    migrations.RunPython(
                        manually_create_indexes_instructions,
                        manually_drop_indexes_instructions,
                    )
                ],
                state_operations=state_ops,
            )
        ]

    return state_ops


class Migration(migrations.Migration):

    dependencies = [
        ('project_ownership', '0009_add_invite_metadata'),
    ]

    operations = get_conditional_operations()
