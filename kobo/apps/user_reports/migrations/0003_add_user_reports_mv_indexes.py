from django.conf import settings
from django.db import migrations

CREATE_PG_TRGM = 'CREATE EXTENSION IF NOT EXISTS pg_trgm;'
DROP_PG_TRGM = 'DROP EXTENSION IF EXISTS pg_trgm;'

# Btree functional indexes for fast case-insensitive prefix (istartswith) searches
CREATE_IDX_EMAIL_LOWER = """
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_reports_email_lower_textpat
ON user_reports_userreportsmv (lower(email) text_pattern_ops);
"""
DROP_IDX_EMAIL_LOWER = """
DROP INDEX IF EXISTS idx_user_reports_email_lower_textpat;
"""

CREATE_IDX_USERNAME_LOWER = """
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_reports_username_lower_textpat
ON user_reports_userreportsmv (lower(username) text_pattern_ops);
"""
DROP_IDX_USERNAME_LOWER = """
DROP INDEX IF EXISTS idx_user_reports_username_lower_textpat;
"""

# GIN index for JSONB subscriptions column
CREATE_IDX_SUBSCRIPTIONS_GIN = """
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_reports_subscriptions_gin
ON user_reports_userreportsmv USING gin (subscriptions);
"""
DROP_IDX_SUBSCRIPTIONS_GIN = """
DROP INDEX IF EXISTS idx_user_reports_subscriptions_gin;
"""

CREATE_IDX_DATE_JOINED = """
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_reports_date_joined
ON user_reports_userreportsmv (date_joined);
"""
DROP_IDX_DATE_JOINED = """
DROP INDEX IF EXISTS idx_user_reports_date_joined;
"""

CREATE_IDX_LAST_LOGIN = """
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_reports_last_login
ON user_reports_userreportsmv (last_login);
"""
DROP_IDX_LAST_LOGIN = """
DROP INDEX IF EXISTS idx_user_reports_last_login;
"""


def manually_create_indexes_instructions(apps, schema_editor):
    print(
        """
        ⚠️ ATTENTION ⚠️
        Run the SQL queries below in PostgreSQL directly to create the indexes:

        {CREATE_PG_TRGM}

        {CREATE_IDX_EMAIL_LOWER}

        {CREATE_IDX_USERNAME_LOWER}

        {CREATE_IDX_SUBSCRIPTIONS_GIN}

        {CREATE_IDX_DATE_JOINED}

        {CREATE_IDX_LAST_LOGIN}

        """
    )


def manually_drop_indexes_instructions(apps, schema_editor):
    print(
        """
        ⚠️ ATTENTION ⚠️
        Run the SQL queries below in PostgreSQL directly to drop the indexes:

        {DROP_IDX_LAST_LOGIN}

        {DROP_IDX_DATE_JOINED}

        {DROP_IDX_SUBSCRIPTIONS_GIN}

        {DROP_IDX_USERNAME_LOWER}

        {DROP_IDX_EMAIL_LOWER}

        {DROP_PG_TRGM}
        """
    )


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('user_reports', '0002_create_user_reports_mv'),
    ]

    if settings.SKIP_HEAVY_MIGRATIONS:
        operations = [
            migrations.RunPython(
                manually_create_indexes_instructions,
                manually_drop_indexes_instructions
            )
        ]
    else:
        operations = [
            migrations.RunSQL(
                sql=CREATE_PG_TRGM,
                reverse_sql=DROP_PG_TRGM
            ),
            migrations.RunSQL(
                sql=CREATE_IDX_EMAIL_LOWER,
                reverse_sql=DROP_IDX_EMAIL_LOWER
            ),
            migrations.RunSQL(
                sql=CREATE_IDX_USERNAME_LOWER,
                reverse_sql=DROP_IDX_USERNAME_LOWER
            ),
            migrations.RunSQL(
                sql=CREATE_IDX_SUBSCRIPTIONS_GIN,
                reverse_sql=DROP_IDX_SUBSCRIPTIONS_GIN
            ),
            migrations.RunSQL(
                sql=CREATE_IDX_DATE_JOINED,
                reverse_sql=DROP_IDX_DATE_JOINED
            ),
            migrations.RunSQL(
                sql=CREATE_IDX_LAST_LOGIN,
                reverse_sql=DROP_IDX_LAST_LOGIN
            ),
        ]
