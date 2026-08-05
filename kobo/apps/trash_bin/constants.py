
DELETE_ATTACHMENT_STR_PREFIX = 'Delete attachment'
DELETE_PROJECT_STR_PREFIX = 'Delete project'
DELETE_USER_STR_PREFIX = 'Delete user’s'

# Failures matching one of these patterns are caused by the infrastructure, not
# by the data being deleted, and are therefore considered retryable
RETRYABLE_FAILURE_PATTERNS = (
    # The task was killed without any traceback (OOMKilled, failed probes, etc.)
    'Worker exited prematurely',
    # MongoDB was unreachable, e.g.: `ServerSelectionTimeoutError`
    'connectTimeoutMS',
    # PostgreSQL picked this task as the victim of a deadlock
    'deadlock detected',
    # Celery hard time limit (`TimeLimitExceeded`) and soft time limit
    # (`SoftTimeLimitExceeded`) once its automatic retries are exhausted
    'TimeLimitExceeded',
)
