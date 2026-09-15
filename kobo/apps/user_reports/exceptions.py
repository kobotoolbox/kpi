class RunTakenOver(Exception):
    """
    Raised when a write to a `BillingAndUsageSnapshotRun` matches no row,
    meaning another worker has claimed it. The displaced worker then stops
    without touching that run again.
    """
