from django.db import models


class InviteStatusChoices(models.TextChoices):

    ACCEPTED = 'accepted'
    CANCELLED = 'cancelled'
    COMPLETE = 'complete'
    DECLINED = 'declined'
    EXPIRED = 'expired'
    FAILED = 'failed'
    IN_PROGRESS = 'in_progress'
    PENDING = 'pending'


class TransferStatusChoices(models.TextChoices):

    CANCELLED = 'cancelled'
    FAILED = 'failed'
    IN_PROGRESS = 'in_progress'
    PENDING = 'pending'
    SUCCESS = 'success'


class TransferStatusErrorLevelChoices(models.TextChoices):
    """
    `INFO` records an intentional skip, e.g. a source file that no longer
    exists. It is not a failure.
    """

    ERROR = 'error'
    INFO = 'info'


class TransferStatusTypeChoices(models.TextChoices):

    ATTACHMENTS = 'attachments'
    MEDIA_FILES = 'media_files'
    GLOBAL = 'global'
    SUBMISSIONS = 'submissions'
