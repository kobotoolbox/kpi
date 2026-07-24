from kpi.utils.log import logging


def run():
    """
    No-op: superseded by Django migrations 0074 (kpi) and 0021 (main).

    The reversion_version and reversion_revision tables are now dropped
    directly via DROP TABLE in those migrations, which is instantaneous in
    PostgreSQL regardless of row count. Batch-deleting rows first is
    unnecessary.
    """
    logging.info(
        'Long running migration 0012 is a no-op: reversion tables are '
        'dropped by Django migrations kpi.0074 and main.0021.'
    )
