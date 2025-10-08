from django.db import migrations

CREATE_PG_TRGM = 'CREATE EXTENSION IF NOT EXISTS pg_trgm;'
DROP_PG_TRGM = 'DROP EXTENSION IF EXISTS pg_trgm;'

# Btree functional indexes for fast case-insensitive prefix (istartswith) searches
CREATE_IDX_EMAIL_LOWER = """
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_reports_email_lower_textpat
ON user_reports_mv (lower(email) text_pattern_ops);
"""
DROP_IDX_EMAIL_LOWER = """
DROP INDEX IF EXISTS idx_user_reports_email_lower_textpat;
"""

CREATE_IDX_USERNAME_LOWER = """
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_reports_username_lower_textpat
ON user_reports_mv (lower(username) text_pattern_ops);
"""
DROP_IDX_USERNAME_LOWER = """
DROP INDEX IF EXISTS idx_user_reports_username_lower_textpat;
"""

# GIN index for JSONB subscriptions column
CREATE_IDX_SUBSCRIPTIONS_GIN = """
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_reports_subscriptions_gin
ON user_reports_mv USING gin (subscriptions);
"""
DROP_IDX_SUBSCRIPTIONS_GIN = """
DROP INDEX IF EXISTS idx_user_reports_subscriptions_gin;
"""

# Numeric / ordering indexes
CREATE_IDX_SUBMISSIONS_ALL_TIME = """
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_reports_submission_all_time
ON user_reports_mv (submission_counts_all_time);
"""
DROP_IDX_SUBMISSIONS_ALL_TIME = """
DROP INDEX IF EXISTS idx_user_reports_submission_all_time;
"""

CREATE_IDX_CURRENT_PERIOD_SUB = """
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_reports_current_period_submissions
ON user_reports_mv (current_period_submissions);
"""
DROP_IDX_CURRENT_PERIOD_SUB = """
DROP INDEX IF EXISTS idx_user_reports_current_period_submissions;
"""

CREATE_IDX_STORAGE_BYTES = """
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_reports_storage_bytes
ON user_reports_mv (storage_bytes_total);
"""
DROP_IDX_STORAGE_BYTES = """
DROP INDEX IF EXISTS idx_user_reports_storage_bytes;
"""

CREATE_IDX_DATE_JOINED = """
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_reports_date_joined
ON user_reports_mv (date_joined);
"""
DROP_IDX_DATE_JOINED = """
DROP INDEX IF EXISTS idx_user_reports_date_joined;
"""

CREATE_IDX_LAST_LOGIN = """
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_reports_last_login
ON user_reports_mv (last_login);
"""
DROP_IDX_LAST_LOGIN = """
DROP INDEX IF EXISTS idx_user_reports_last_login;
"""


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ("user_reports", "0002_create_user_reports_mv"),
    ]

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
            sql=CREATE_IDX_SUBMISSIONS_ALL_TIME,
            reverse_sql=DROP_IDX_SUBMISSIONS_ALL_TIME
        ),
        migrations.RunSQL(
            sql=CREATE_IDX_CURRENT_PERIOD_SUB,
            reverse_sql=DROP_IDX_CURRENT_PERIOD_SUB
        ),
        migrations.RunSQL(
            sql=CREATE_IDX_STORAGE_BYTES,
            reverse_sql=DROP_IDX_STORAGE_BYTES
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
