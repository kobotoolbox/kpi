from django.conf import settings
from django.db import connection, connections


def run():
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
            else:
                print('Migration kobo_auth.0001 already applied. Skip!')
        else:
            raise Exception('Run `./manage.py migrate auth` first')
