from django.conf import settings
from django.db import migrations, models
from django.db.models import Func, Value
from django.db.models.functions import Lower


def manually_create_indexes_instructions(apps, schema_editor):
    print("""
        ⚠️ ATTENTION ⚠️
        Run the SQL query below in PostgreSQL directly:

        CREATE INDEX CONCURRENTLY IF NOT EXISTS
        "auth_user_email_domain_idx" ON
        "auth_user" (split_part(lower("email"), '@', 2));
    """)


def manually_drop_indexes_instructions(apps, schema_editor):
    print("""
        ⚠️ ATTENTION ⚠️
        Run the SQL query below in PostgreSQL directly:

        DROP INDEX CONCURRENTLY IF EXISTS "auth_user_email_domain_idx";
        """)


def get_conditional_operations():
    state_ops = [
        migrations.AddIndex(
            model_name='user',
            index=models.Index(
                Func(
                    Lower('email'),
                    Value('@'),
                    Value(2),
                    function='split_part',
                    output_field=models.CharField(),
                ),
                name='auth_user_email_domain_idx',
            ),
        )
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
        ('kobo_auth', '0001_initial'),
    ]

    operations = [
        *get_conditional_operations(),
    ]
