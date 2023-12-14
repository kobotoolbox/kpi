from django.db import models


class InviteStatusChoices(models.TextChoices):

    ACCEPTED = 'accepted', 'ACCEPTED'
    CANCELLED = 'cancelled', 'CANCELLED'
    COMPLETE = 'complete', 'COMPLETE'
    DECLINED = 'declined', 'DECLINED'
    FAILED = 'failed', 'FAILED'
    IN_PROGRESS = 'in_progress', 'IN PROGRESS'
    PENDING = 'pending', 'PENDING'


class TransferStatusChoices(models.TextChoices):

    CANCELLED = 'cancelled', 'CANCELLED'
    FAILED = 'failed', 'FAILED'
    IN_PROGRESS = 'in_progress', 'IN PROGRESS'
    PENDING = 'pending', 'PENDING'
    SUCCESS = 'success', 'SUCCESS'


class TransferStatusTypeChoices(models.TextChoices):

    ATTACHMENTS = 'attachments', 'ATTACHMENTS'
    MEDIA_FILES = 'media_files', 'MEDIA_FILES'
    GLOBAL = 'global', 'GLOBAL'
    SUBMISSIONS = 'submissions', 'SUBMISSIONS'

    @classmethod
    def default_statuses_dict(cls):
        _default_dict = {}
        for value in cls.values:
            _default_dict[value] = TransferStatusChoices.PENDING.value
        return _default_dict
