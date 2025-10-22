from typing import Final, Tuple

from django.utils.translation import gettext_lazy as t

ACCOUNT_TYPE_PERSONAL: Final[str] = 'personal'
ACCOUNT_TYPE_ORGANIZATIONAL: Final[str] = 'organizational'

ACCOUNT_TYPE_CHOICES: Final[Tuple[tuple[str, str], ...]] = (
    (ACCOUNT_TYPE_PERSONAL, t('Personal account')),
    (ACCOUNT_TYPE_ORGANIZATIONAL, t('Organizational account')),
)

PERSONAL_ALLOWED_MODULES: Final[tuple[str, ...]] = (
    'form-manager',
    'library',
)

ORGANIZATIONAL_ALLOWED_MODULES: Final[tuple[str, ...]] = (
    'form-manager',
    'library',
    'management',
    'collection',
    'quality-control',
    'mranalysis',
)

PERSONAL_STORAGE_LIMIT_MB: Final[int] = 500

PAYMENT_STATUS_PENDING: Final[str] = 'pending'
PAYMENT_STATUS_CONFIRMED: Final[str] = 'confirmed'
PAYMENT_STATUS_NOT_REQUIRED: Final[str] = 'not_required'
