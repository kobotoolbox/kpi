from django.contrib.auth.signals import user_logged_in
from django.db.models.signals import post_save
from django.dispatch import receiver

from kpi.constants import SUBMISSION_GROUP_LATEST_KEY
from kpi.utils.log import logging
from .models import AuditLog, SubmissionAccessLog, SubmissionGroup

GROUP_DELTA_MINUTES = 60


@receiver(user_logged_in)
def create_access_log(sender, user, **kwargs):
    request = kwargs['request']
    if not hasattr(request, 'user'):
        # This should never happen outside of tests
        logging.warning('Request does not have authenticated user attached.')
        log = AuditLog.create_access_log_for_request(request, user)
    else:
        log = AuditLog.create_access_log_for_request(request)
    log.save()


@receiver(post_save, sender=SubmissionAccessLog)
def add_submission_to_group(sender, instance, created, **kwargs):
    if not created:
        return
    # find the most recent submission group log for this user
    latest_group = (
        SubmissionGroup.objects.filter(user=instance.user).order_by(
            f'-metadata__{SUBMISSION_GROUP_LATEST_KEY}'
        )
    ).first()
    if latest_group is not None:
        latest_date = latest_group.metadata[SUBMISSION_GROUP_LATEST_KEY]
        delta = instance.date_created - latest_date
        total_seconds = GROUP_DELTA_MINUTES * 60
        # if this was submitted within GROUP_DELTA_MINUTES after the most recent entry in the latest
        # SubmissionGroup, add it to that group
        if delta.total_seconds() < total_seconds:
            latest_group.add_submission_to_group(instance)
            latest_group.save()
            return

    new_group = instance.create_new_group_log()
    new_group.save()
