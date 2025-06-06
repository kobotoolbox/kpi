# flake8: noqa: E501
# Generated by Django 4.2.15 on 2025-03-14 14:59

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

import kpi.fields.kpi_uid


def manually_create_indexes_instructions(apps, schema_editor):
    print(
        """
        ⚠️ ATTENTION ⚠️
        Run the SQL queries below in PostgreSQL directly:

            ```sql
            --
            -- Rename fields
            --
            ALTER TABLE "logger_attachment" RENAME COLUMN "xform" TO "xform_id";
            ALTER TABLE "logger_attachment" RENAME COLUMN "user" TO "user_id";

            --
            -- Add index on field delete_status on attachment
            --
            CREATE INDEX CONCURRENTLY "logger_attachment_delete_status_19ec7f2f" ON "logger_attachment" ("delete_status");
            CREATE INDEX CONCURRENTLY "logger_attachment_delete_status_19ec7f2f_like" ON "logger_attachment" ("delete_status" varchar_pattern_ops);

            --
            -- Add unique index on field uid on attachment
            --
            CREATE UNIQUE INDEX CONCURRENTLY "unique_att_uid" ON "logger_attachment" ("uid");
            ALTER TABLE "logger_attachment" ADD CONSTRAINT "logger_attachment_uid_99ff28ae_uniq" UNIQUE USING INDEX "unique_att_uid";
            CREATE INDEX CONCURRENTLY "logger_attachment_uid_99ff28ae_like" ON "logger_attachment" ("uid" varchar_pattern_ops);

            --
            -- Add foreign key on field user_id on attachment
            --
            CREATE INDEX CONCURRENTLY "logger_attachment_user_id_4fde878d" ON "logger_attachment" ("user_id");
            ALTER TABLE "logger_attachment" ADD CONSTRAINT "logger_attachment_user_id_4fde878d_fk_auth_user_id" FOREIGN KEY ("user_id") REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED;

            --
            -- Add foreign key on field xform_id on attachment
            --
            CREATE INDEX CONCURRENTLY "logger_attachment_xform_id_22b4fd1f" ON "logger_attachment" ("xform_id");
            ALTER TABLE "logger_attachment" ADD CONSTRAINT "logger_attachment_xform_id_22b4fd1f_fk_logger_xform_id" FOREIGN KEY ("xform_id") REFERENCES "logger_xform" ("id") DEFERRABLE INITIALLY DEFERRED;
            ```

        """
    )


def manually_drop_indexes_instructions(apps, schema_editor):
    print(
        """
        ⚠️ ATTENTION ⚠️
        Run the SQL queries below in PostgreSQL directly:

            ```sql
            ALTER TABLE "logger_attachment" DROP CONSTRAINT "logger_attachment_uid_99ff28ae_uniq";
            ALTER TABLE "logger_attachment" DROP CONSTRAINT "logger_attachment_user_id_4fde878d_fk_auth_user_id";
            ALTER TABLE "logger_attachment" DROP CONSTRAINT "logger_attachment_xform_id_22b4fd1f_fk_logger_xform_id";
            DROP INDEX CONCURRENTLY IF EXISTS "logger_attachment_user_id_4fde878d";
            DROP INDEX CONCURRENTLY IF EXISTS "logger_attachment_xform_id_22b4fd1f";
            DROP INDEX CONCURRENTLY IF EXISTS "logger_attachment_delete_status_19ec7f2f";
            DROP INDEX CONCURRENTLY IF EXISTS "logger_attachment_delete_status_19ec7f2f_like";
            DROP INDEX CONCURRENTLY IF EXISTS "logger_attachment_uid_99ff28ae_like";
            ALTER TABLE "logger_attachment" RENAME COLUMN "xform_id" TO "xform";
            ALTER TABLE "logger_attachment" RENAME COLUMN "user_id" TO "user";
            ```

        """
    )


def get_conditional_operations():

    if settings.SKIP_HEAVY_MIGRATIONS:
        return [
            migrations.RunPython(
                manually_create_indexes_instructions,
                manually_drop_indexes_instructions,
            )
        ]
    else:
        # Add indexes with DJANGO
        return [
            migrations.AlterField(
                model_name='attachment',
                name='delete_status',
                field=models.CharField(
                    choices=[
                        ('deleted', 'Deleted'),
                        ('soft-deleted', 'Soft Deleted'),
                        ('pending-delete', 'Pending Delete'),
                    ],
                    db_index=True,
                    max_length=20,
                    null=True,
                ),
            ),
            migrations.AlterField(
                model_name='attachment',
                name='uid',
                field=kpi.fields.kpi_uid.KpiUidField(
                    _null=True, null=True, uid_prefix='att'
                ),
            ),
            migrations.AlterField(
                model_name='attachment',
                name='user',
                field=models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='attachments',
                    to=settings.AUTH_USER_MODEL,
                ),
            ),
            migrations.AlterField(
                model_name='attachment',
                name='xform',
                field=models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='attachments',
                    to='logger.xform',
                ),
            ),
        ]


class Migration(migrations.Migration):

    dependencies = [
        ('logger', '0042_add_field_hash_to_attachment'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='attachment',
            name='user',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='attachment',
            name='xform',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='attachment',
            name='date_created',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='attachment',
            name='date_modified',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='attachment',
            name='uid',
            field=models.CharField(blank=True, null=True, max_length=24),
        ),
        migrations.AddField(
            model_name='attachment',
            name='delete_status',
            field=models.CharField(
                choices=[
                    ('deleted', 'Deleted'),
                    ('soft-deleted', 'Soft Deleted'),
                    ('pending-delete', 'Pending Delete'),
                ],
                max_length=20,
                null=True,
            ),
        ),
        *get_conditional_operations(),
    ]
