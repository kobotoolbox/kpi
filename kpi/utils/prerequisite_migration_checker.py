from django.core.checks import Error
from django.db import connections
from django.db.utils import OperationalError, ProgrammingError


class PrerequisiteMigrationChecker:
    """
    Prevents startup when a required prerequisite migration has not been
    applied.

    Instances upgrading from a release older than 2.025.37 must first upgrade
    to 2.025.37 (which ships migration kpi.0069) before upgrading to this
    version. Without that migration, the reversion FK is still present in the
    database and the cleanup migrations in this release cannot run correctly.
    """

    REQUIRED_MIGRATIONS = [
        (
            'kpi',
            '0069_alter_assetversion_reversion_version',
            'KPI.E024',
            (
                'Migration kpi.0069 has not been applied. '
                'You must upgrade to release 2.025.37 before upgrading to '
                'this version. See the release notes for the required upgrade '
                'path.'
            ),
        ),
    ]

    def do_checks(self, app_configs, **kwargs):
        errors = []
        connection = connections['default']

        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT 1 FROM pg_tables"
                    " WHERE tablename = 'django_migrations' LIMIT 1"
                )
                if not cursor.fetchone():
                    # Fresh installation — django_migrations does not exist yet.
                    return errors

                cursor.execute(
                    "SELECT 1 FROM django_migrations WHERE app = 'kpi' LIMIT 1"
                )
                if not cursor.fetchone():
                    # No kpi migrations applied at all — fresh installation.
                    return errors

                for app, name, error_id, hint in self.REQUIRED_MIGRATIONS:
                    cursor.execute(
                        'SELECT 1 FROM django_migrations'
                        ' WHERE app = %s AND name = %s',
                        [app, name],
                    )
                    if not cursor.fetchone():
                        errors.append(
                            Error(
                                f'Required migration {app}.{name} has not been applied.',
                                hint=hint,
                                id=error_id,
                            )
                        )
        except (OperationalError, ProgrammingError):
            pass

        return errors

    def as_check(self):
        """
        For use with django.core.checks.register().
        """

        def wrapper(*args, **kwargs):
            return self.do_checks(*args, **kwargs)

        return wrapper
