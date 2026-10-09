# One hash per user, token -> registration timestamp, see `suspend_submissions()`
SUBMISSIONS_SUSPENDED_HOLDERS_KEY_PREFIX = 'kobo:submissions_suspended:holders:'
# TODO Remove this key (and `_legacy_holder_alive()`) in the release following
#  the one where this commit has been deployed to production: only workers
#  running the previous `update_attachment_storage_bytes` still write it
LEGACY_SUBMISSIONS_SUSPENDED_HEARTBEAT_KEY = (
    'kobo:update_attachment_storage_bytes:heartbeat'
)
# One lock per project, see `recount_storage_counter()`
RECOUNT_STORAGE_LOCK_KEY_PREFIX = 'kobo:recount_storage:xform:'
# Only one rotating recount at a time, see `recount_drifted_storage_counters()`
RECOUNT_STORAGE_ROTATION_LOCK_KEY = 'kobo:recount_storage:rotation:lock'
# Last project recounted by the rotation, which resumes after it
RECOUNT_STORAGE_ROTATION_CURSOR_KEY = 'kobo:recount_storage:rotation:last_xform_id'
# One cursor per selection of `update_attachment_storage_bytes`, so that an
# interrupted run resumes where it stopped
RECOUNT_STORAGE_COMMAND_CURSOR_KEY_PREFIX = 'kobo:recount_storage:command:'
# Projects of owners active in that many last days get recounted, see
# `get_xform_ids_to_recount()`
RECOUNT_STORAGE_ACTIVE_USER_DAYS = 730
