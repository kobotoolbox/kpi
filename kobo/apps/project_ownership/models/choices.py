from django.db import models


class InviteStatus(models.TextChoices):

    COMPLETE = 'complete', 'COMPLETE'
    DECLINED = 'declined', 'DECLINED'
    FAILED = 'failed', 'FAILED'
    IN_PROGRESS = 'in_progress', 'IN PROGRESS'
    PENDING = 'pending', 'PENDING'


class TransferAsyncTask(models.TextChoices):

    SUBMISSIONS = 'submissions', 'SUBMISSIONS'
    ATTACHMENTS = 'attachments', 'ATTACHMENTS'
    MEDIA_FILES = 'media_files', 'MEDIA_FILES'

    @classmethod
    def default_statuses_dict(cls):
        _default_dict = {}
        for choice in cls.choices:
            _default_dict[choice.value] = TransferStatus.PENDING
        return _default_dict


class TransferStatus(models.TextChoices):

    CANCELLED = 'cancelled', 'CANCELLED'
    FAILED = 'failed', 'FAILED'
    IN_PROGRESS = 'in_progress', 'IN PROGRESS'
    PENDING = 'pending', 'PENDING'
    SUCCESS = 'success', 'SUCCESS'
