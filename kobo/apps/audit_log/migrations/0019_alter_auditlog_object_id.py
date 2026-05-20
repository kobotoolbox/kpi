from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Avoids a full table rewrite on the huge audit_log table.

    The naive AlterField (bigint → varchar) would issue:
        ALTER TABLE audit_log_auditlog ALTER COLUMN object_id TYPE varchar(255)
    which acquires ACCESS EXCLUSIVE and rewrites every row — blocking for hours
    on a table with hundreds of millions of rows.

    Instead we:
      1. Add a new nullable column `object_id_char` (instant DDL, no rewrite).
      2. Tell Django's ORM that the `object_id` field lives in `object_id_char`
         (via db_column). New writes land there immediately.
      3. Leave the legacy `object_id` bigint column untouched. Historical rows
         are still readable via the `object_id_legacy` model field.

    Back-filling `object_id_char` for historical rows is deferred; the
    application handles the dual-column reality via Coalesce in queries and a
    fallback in the serializer layer.
    """

    dependencies = [
        ('audit_log', '0018_alter_auditlog_action_alter_auditlog_log_type'),
    ]

    operations = [
        # Add the new varchar column. Nullable so the DDL is instant: PostgreSQL
        # stores no physical data for the new column on existing rows.
        migrations.RunSQL(
            sql=(
                'ALTER TABLE audit_log_auditlog '
                'ADD COLUMN object_id_char VARCHAR(255) NULL'
            ),
            reverse_sql=(
                'ALTER TABLE audit_log_auditlog DROP COLUMN IF EXISTS object_id_char'
            ),
        ),
        # Drop the NOT NULL constraint on the legacy bigint column so that new
        # rows (which write to object_id_char instead) can leave it NULL.
        # This is a catalog-only change in PostgreSQL — no table rewrite, instant
        # even on a table with hundreds of millions of rows.
        migrations.RunSQL(
            sql='ALTER TABLE audit_log_auditlog ALTER COLUMN object_id DROP NOT NULL',
            reverse_sql=(
                'ALTER TABLE audit_log_auditlog ALTER COLUMN object_id SET NOT NULL',
            )
        ),
        # Update Django's state so the ORM treats `object_id` as a CharField
        # backed by `object_id_char`. No DDL is emitted for this operation.
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AlterField(
                    model_name='auditlog',
                    name='object_id',
                    field=models.CharField(
                        max_length=255,
                        null=True,
                        db_column='object_id_char',
                    ),
                ),
                # Register the legacy bigint column in Django's migration state
                # so makemigrations does not try to create it. The column already
                # exists in the database; no DDL is needed.
                migrations.AddField(
                    model_name='auditlog',
                    name='object_id_legacy',
                    field=models.BigIntegerField(
                        db_column='object_id', null=True, editable=False
                    ),
                ),
            ],
            database_operations=[],
        ),
    ]
