class LongRunningMigrationDependencyError(Exception):
    """
    Raised when a long-running migration cannot start because a required
    predecessor migration has not yet reached a terminal state
    (completed or failed). The current migration will be retried on the
    next Celery beat cycle without being marked as failed.
    """
