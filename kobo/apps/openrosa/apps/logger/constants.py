# One hash per user, token -> registration timestamp, see `suspend_submissions()`
SUBMISSIONS_SUSPENDED_HOLDERS_KEY_PREFIX = 'kobo:submissions_suspended:holders:'
# TODO Remove this key (and `_legacy_holder_alive()`) in the release following
#  the one where this commit has been deployed to production: only workers
#  running the previous `update_attachment_storage_bytes` still write it
LEGACY_SUBMISSIONS_SUSPENDED_HEARTBEAT_KEY = (
    'kobo:update_attachment_storage_bytes:heartbeat'
)
