# coding: utf-8
import os
import sys

from django.core.checks import Error


class MigrationScriptChecker:
    """
    Block the `migrate` management command unless it's being invoked through
    `scripts/migrate.sh`
    """

    SENTINEL_ENV_VAR = '__KOBO_MIGRATE_SH_SENTINEL__'

    @classmethod
    def __str__(cls):
        return cls.__name__

    def as_check(self):
        """
        For use with django.core.checks.register()
        """

        def wrapper(*args, **kwargs):
            if sys.argv[1] == 'migrate' and self.SENTINEL_ENV_VAR not in os.environ:
                return [
                    Error(
                        'Migrations must be run via `scripts/migrate.sh`',
                        hint=(
                            'Instead of using the `migrate` management command'
                            ' directly, invoke `scripts/migrate.sh` instead.'
                        ),
                        obj=self,
                        id='KPI.E024',
                    )
                ]
            return []

        return wrapper
