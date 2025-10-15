from django.db import connection


def run():
    if should_fix_internal_mfa_app_label():
        fix_internal_mfa_app_label()


def should_fix_internal_mfa_app_label():
    """
    Checks for accounts_mfa migrations with the previous app label
    """
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT * FROM django_migrations WHERE app = 'mfa' AND name = '0002_add_mfa_available_to_user_model';"
        )
        return cursor.fetchone() is not None


def fix_internal_mfa_app_label():
    """
    Changes the known migration names for the internal accounts_mfa app
    """
    with connection.cursor() as cursor:
        cursor.execute("""
        UPDATE django_migrations SET app='accounts_mfa' WHERE app='mfa' AND name IN (
            '0001_initial',
            '0002_add_mfa_available_to_user_model',
            '0003_rename_kobo_mfa_method_model',
            '0004_alter_mfamethod_date_created_and_more'
        )
        """)
        print(f'Fixing accounts_mfa app migration records. Modified {cursor.rowcount} records in django_migrations')
