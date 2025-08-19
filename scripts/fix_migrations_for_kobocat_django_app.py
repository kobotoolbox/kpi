from django.conf import settings
from django.db import connection, connections


def run():
    if not are_migration_already_applied():
        return

    if migrate_custom_user_model():
        # Only run it when custom user model migrations have been fixed
        delete_kobocat_form_disclaimer_app()


def are_migration_already_applied():
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT EXISTS ("
            "    SELECT FROM pg_tables"
            "    WHERE  schemaname = 'public'"
            "   AND    tablename  = 'django_migrations'"
            ");"
        )
        row = cursor.fetchone()
        return bool(row[0])


def delete_kobocat_form_disclaimer_app():
    """
    KoboCAT form_disclaimer app does not exist anymore but its migrations
    create conflicts and must be deleted before applying other migrations.
    """
    with connections[settings.OPENROSA_DB_ALIAS].cursor() as kc_cursor:
        kc_cursor.execute(
            "DELETE FROM django_migrations "
            "WHERE app = 'form_disclaimer';"
        )


def migrate_custom_user_model():
    """
    Insert an entry in django_migrations for existing setups.
    Because kobo_auth.User becomes the (custom) User model, we enter
    a chicken or the egg condition, i.e.: some migrations depend on the User
    model to be created first, but custom User is not and those migrations are
    already applied. It makes Django raise an InconsistentMigrationHistory error.
    """
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT id FROM django_migrations "
            "WHERE app = 'auth' AND name = '0012_alter_user_first_name_max_length';"
        )
        row = cursor.fetchone()

        if row:
            cursor.execute(
                "SELECT id FROM django_migrations "
                "WHERE app = 'kobo_auth' AND name = '0001_initial';"
            )
            row = cursor.fetchone()
            if not row:
                cursor.execute(
                    "INSERT INTO django_migrations (app, name, applied) "
                    "VALUES ('kobo_auth', '0001_initial', NOW());"
                    "UPDATE django_content_type SET app_label = 'kobo_auth' "
                    "WHERE app_label = 'auth' and model = 'user';"
                )

                with connections[settings.OPENROSA_DB_ALIAS].cursor() as kc_cursor:
                    kc_cursor.execute(
                        "INSERT INTO django_migrations (app, name, applied) "
                        "VALUES ('kobo_auth', '0001_initial', NOW());"
                        "UPDATE django_content_type SET app_label = 'kobo_auth' "
                        "WHERE app_label = 'auth' and model = 'user';"
                    )
                return True
            else:
                print('Migration kobo_auth.0001 already applied. Skip!')
                return False
        else:
            raise Exception('Run `./manage.py migrate auth` first')
