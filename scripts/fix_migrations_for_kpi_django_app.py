from django.conf import settings
from django.db import connection, connections


def run():
    if should_migrate_internal_mfa_app():
        migrate_internal_mfa_app()


def should_migrate_internal_mfa_app():
    """
    Check if the 2nd migration name is present in the django migrations table
    """
    with connection.cursor() as kpi_cursor:
        kpi_cursor.execute(
            "SELECT * FROM django_migrations WHERE app = 'mfa' AND name = '0002_add_mfa_available_to_user_model';"
        )
        return cursor.fetchone() is not None


def migrate_internal_mfa_app():
    """
    Only change the known migration names in the old internal mfa app
    """
    with connection.cursor() as cursor:
        cursor.execute("""
        UPDATE django_migrations SET app = 'accounts_mfa' WHERE app='mfa' AND name IN (
            '0001_initial'
            '0002_add_mfa_available_to_user_model',
            '0003_rename_kobo_mfa_method_model',
            '0004_alter_mfamethod_date_created_and_more'
        )
        """)
