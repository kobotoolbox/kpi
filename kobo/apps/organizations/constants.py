from django.db import models
from django.utils.translation import gettext_lazy as t


class UsageType(models.TextChoices):
    SUBMISSION = 'submission'
    STORAGE_BYTES = 'storage_bytes'
    MT_CHARACTERS = 'mt_characters'
    ASR_SECONDS = 'asr_seconds'
    LLM_REQUESTS = 'llm_requests'
    LOG_LOOKBACK_DAYS = 'log_lookback_days'


USAGE_TYPES_WITH_COUNTERS = [
    choice for choice in UsageType.choices if choice[0] != UsageType.LOG_LOOKBACK_DAYS
]

# Every message below reaches the UI, so it must be translatable. Wrap here
# rather than at the call site: `makemessages` only extracts literal arguments,
# so `t(CONSTANT)` would leave the string out of the catalogs entirely.
INVITE_OWNER_ERROR = t(
    'This account is already the owner of ##organization_name##. '
    'You cannot join multiple organizations with the same account. '
    'To accept this invitation, you must either transfer ownership of '
    '##organization_name## to a different account or sign in using a different '
    'account with the same email address. If you do not already have another '
    'account, you can create one.'
)

INVITE_MEMBER_ERROR = t(
    'This account is already a member in ##organization_name##. '
    'You cannot join multiple organizations with the same account. '
    'To accept this invitation, sign in using a different account with the '
    'same email address. If you do not already have another account, you can '
    'create one.'
)

INVALID_ROLE_ERROR = t("Invalid role. Only 'admin' or 'member' are allowed")
INVITE_ALREADY_ACCEPTED_ERROR = t('Invite has already been accepted.')
INVITE_CANNOT_BE_RESENT_ERROR = t('Invitation cannot be resent')
INVITE_NOT_FOUND_ERROR = t('Invite not found.')
INVITE_RESENT_TOO_QUICKLY_ERROR = t(
    'Invitation resent too quickly, wait for ##minutes## minutes before retrying'
)
INVITE_ROLE_LOCKED_ERROR = t('Role cannot be changed after acceptance')
INVITE_STATUS_RESERVED_ERROR = t('`##status##` is reserved and cannot be set')
INVITE_STATUS_UNSETTABLE_ERROR = t(
    '`##status##` cannot be set on a newly created invitation'
)
NOT_ENOUGH_PERMISSIONS_ERROR = t(
    'You do not have enough permissions to perform this action'
)
ORG_ADMIN_ROLE = 'admin'
ORG_EXTERNAL_ROLE = 'external'
ORG_MEMBER_ROLE = 'member'
ORG_OWNER_ROLE = 'owner'
USER_DOES_NOT_EXIST_ERROR = t(
    'User with username or email `##invitee##` does not exist or is not active.'
)
INVITE_ALREADY_EXISTS_ERROR = t('An active invitation already exists for `##invitee##`')
INVITEE_ALREADY_MEMBER_ERROR = t('User is already a member of this organization.')
