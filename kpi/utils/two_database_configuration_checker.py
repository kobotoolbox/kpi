# coding: utf-8
from django.conf import settings
from django.core.checks import Error
from django.db import connections
from django.utils.translation import ugettext as _

from kpi.management.commands.is_database_empty import (
    test_table_exists_and_has_any_row,
)


class TwoDatabaseConfigurationChecker:
    """
    This class detects certain problems that might arise when upgrading an
    installation that used a single, shared database for both KPI and KoBoCAT
    to a new configuration with separate databases for each Django project.

    If any issue is found, the application should be stopped to avoid a messy
    situation where KPI data from two databases would have to be merged
    together, as opposed to simply copied from the old database to the new one.
    """

    HELP_PAGE = 'https://community.kobotoolbox.org/t/upgrading-to-separate-databases-for-kpi-and-kobocat/7202'
    GUIDANCE_TEMPLATE = 'For assistance, please visit {HELP_PAGE}.'

    def __init__(self):
        self.errors = []

    @classmethod
    def __str__(cls):
        return cls.__name__

    @property
    def guidance_message(self):
        return ' ' + _(self.GUIDANCE_TEMPLATE).format(HELP_PAGE=self.HELP_PAGE)

    def check_for_two_databases(self):
        if sorted(list(settings.DATABASES.keys())) != ['default', 'kobocat']:
            self.errors.append(Error(
                _('Exactly two databases must be configured'),
                hint=_('KPI and KoBoCAT must each have their own databases. '
                       "Configure the KPI database as 'default' and the "
                       "KoBoCAT database as 'kobocat'.")
                      + self.guidance_message,
                obj=self,
                id='KPI.E021',
            ))
            return False
        return True

    def check_for_distinct_databases(self):
        DATABASE_IDENTIFYING_KEYS = ['HOST', 'PORT', 'NAME']
        kpi_db = settings.DATABASES['default']
        kc_db = settings.DATABASES['kobocat']
        databases_distinct = False
        for key_to_check in DATABASE_IDENTIFYING_KEYS:
            if kpi_db[key_to_check] != kc_db[key_to_check]:
                databases_distinct = True
                break
        if not databases_distinct:
            self.errors.append(Error(
                _('KPI may not share a database with KoBoCAT'),
                hint=_('KPI and KoBoCAT must each have their own databases.')
                       + self.guidance_message,
                obj=self,
                id='KPI.E022',
            ))
            return False
        return True

    def check_for_kpi_data_in_kobocat_database(self):
        """
        If there's no KPI data in the KoBoCAT database, there's no need to run
        `check_for_migration_from_shared_database()`
        """
        connection = connections['kobocat']
        with connection.cursor() as cursor:
            return test_table_exists_and_has_any_row(cursor, 'kpi_asset')

    def check_for_migration_from_shared_database(self):
        def db_contains_app_migrations(db_connection, app):
            # Does the migrations table exist?
            with db_connection.cursor() as cursor:
                cursor.execute(
                    '''SELECT (1) AS "exists" FROM "pg_tables" '''
                    '''WHERE "tablename" = 'django_migrations' '''
                    '''LIMIT 1;'''
                )
                if not cursor.fetchone():
                    return False
            # Does the migrations table contain any KPI migration?
            with db_connection.cursor() as cursor:
                cursor.execute(
                    '''SELECT (1) AS "exists" FROM "django_migrations" '''
                    '''WHERE "app" = %s '''
                    '''LIMIT 1;''', [app]
                )
                if not cursor.fetchone():
                    return False
            return True

        kpi_connection = connections['default']
        kc_connection = connections['kobocat']
        kpi_app = 'kpi'
        kc_app = 'logger'

        if db_contains_app_migrations(kc_connection, kpi_app):
            # This was formerly a single-database setup, since the KC database
            # contains KPI migrations
            if not db_contains_app_migrations(kpi_connection, kc_app):
                # When migrating from the single, shared database setup:
                #   1. A new database for KPI should have been created;
                #   2. Certain tables, including `django_migrations`, should
                #      have been copied from the original, shared database to
                #      the new one;
                #   3. KoBoCAT should have been configured to continue using
                #      the original database;
                #   4. KPI should have been configured to use the newly-created
                #      database;
                #   5. Because `django_migrations` should have been copied from
                #      the original database to the new one, we should see
                #      KoBoCAT migrations in the KPI database.
                # Since we _do not_ see any KoBoCAT migrations, stop now and
                # get the human to fix their installation.
                self.errors.append(Error(
                    _('Incomplete migration from shared-database installation'),
                    hint=_('The KoBoCAT database was originally shared by '
                           'KPI, but the KPI tables were not copied from that '
                           'shared database to the new, KPI-only database.')
                         + self.guidance_message,
                    obj=self,
                    id='KPI.E023',
                ))
                return False
        return True

    def do_checks(self, app_configs, **kwargs):
        checks = [
            self.check_for_two_databases,
            self.check_for_distinct_databases,
            self.check_for_kpi_data_in_kobocat_database,
            self.check_for_migration_from_shared_database,
        ]
        for check in checks:
            if not check():
                # Each check depends on the one before; it makes no sense to
                # continue any further
                break
        return self.errors

    def as_check(self):
        """ For use with django.core.checks.register() """

        def wrapper(*args, **kwargs):
            return self.do_checks(*args, **kwargs)
        return wrapper
