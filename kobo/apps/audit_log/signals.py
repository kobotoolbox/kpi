from datetime import timedelta

from django.conf import settings
from django.contrib.auth.signals import user_logged_in
from django.db.models.signals import post_save
from django.dispatch import receiver

from kpi.utils.log import logging
from .models import AccessLog, SubmissionAccessLog, SubmissionGroup


@receiver(user_logged_in)
def create_access_log(sender, user, **kwargs):
    request = kwargs['request']
    if not hasattr(request, 'user'):
        # This should never happen outside of tests
        logging.warning('Request does not have authenticated user attached.')
        AccessLog.create_from_request(request, user)
    else:
        AccessLog.create_from_request(request)


@receiver(post_save, sender=SubmissionAccessLog)
def add_submission_to_group(sender, instance, created, **kwargs):
    # this is only for new submission logs
    if not created:
        return

    # find the submission group created most recently for this user
    latest_group = (
        SubmissionGroup.objects.filter(user_uid=instance.user_uid)
        .order_by('-date_created')
        .first()
    )
    if latest_group is not None:
        time_limit = settings.ACCESS_LOG_SUBMISSION_GROUP_TIME_LIMIT_MINUTES
        # find the most recent submission in that group
        latest_entry = latest_group.submissions.order_by(
            '-date_created'
        ).first()
        # determine the minimum cut off date/time for submissions that should be in the
        # same group as the current instance
        cut_off_time = instance.date_created - timedelta(minutes=time_limit)
        if latest_entry.date_created >= cut_off_time:
            # if the most recent submission in the most recent group is greater than
            # the cutoff, add the instance to the existing group
            instance.add_to_existing_submission_group(latest_group)
            instance.save()
            return
    # we can't add to an existing group, so create a new one and add the instance to it
    instance.create_and_add_to_new_submission_group()
    instance.save()


@receiver(post_save, sender=SubmissionGroup)
def assign_self_to_group(sender, instance, created, **kwargs):
    # assign a submission group to itself. This makes the grouping query easier
    if not created:
        # only for new submission groups
        return
    instance.submission_group = instance
    instance.save()
