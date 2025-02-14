INVITE_OWNER_ERROR = (
    'This account is already the owner of ##organization_name##. '
    'You cannot join multiple organizations with the same account. '
    'To accept this invitation, you must either transfer ownership of '
    '##organization_name## to a different account or sign in using a different '
    'account with the same email address. If you do not already have another '
    'account, you can create one.'
)

INVITE_MEMBER_ERROR = (
    'This account is already a member in ##organization_name##. '
    'You cannot join multiple organizations with the same account. '
    'To accept this invitation, sign in using a different account with the '
    'same email address. If you do not already have another account, you can '
    'create one.'
)

INVITE_ALREADY_ACCEPTED_ERROR = 'Invite has already been accepted.'
INVITE_NOT_FOUND_ERROR = 'Invite not found.'
ORG_ADMIN_ROLE = 'admin'
ORG_EXTERNAL_ROLE = 'external'
ORG_MEMBER_ROLE = 'member'
ORG_OWNER_ROLE = 'owner'
USER_DOES_NOT_EXIST_ERROR = (
    'User with username or email `##invitee##` does not exist or is not active.'
)
INVITE_ALREADY_EXISTS_ERROR = (
    'An active invitation already exists for `##invitee##`'
)
INVITEE_ALREADY_MEMBER_ERROR = (
    'User is already a member of this organization.'
)
