# coding: utf-8
import logging

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.db.models import Case, F, When
from django.db.models.signals import post_delete, post_save, pre_delete
from django.dispatch import receiver

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models.attachment import Attachment
from kobo.apps.openrosa.apps.logger.models.daily_xform_submission_counter import (
    DailyXFormSubmissionCounter,
)
from kobo.apps.openrosa.apps.logger.models.instance import Instance
from kobo.apps.openrosa.apps.logger.models.monthly_xform_submission_counter import (
    MonthlyXFormSubmissionCounter,
)
from kobo.apps.openrosa.apps.logger.models.xform import XForm
from kobo.apps.openrosa.apps.main.models.user_profile import UserProfile
from kobo.apps.openrosa.libs.utils.guardian import assign_perm, get_perms_for_model
from kobo.apps.openrosa.libs.utils.image_tools import get_optimized_image_path
from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage as default_storage,
)


@receiver(pre_delete, sender=Attachment)
def pre_delete_attachment(instance, **kwargs):
    # "Model.delete() isn’t called on related models, but the pre_delete and
    # post_delete signals are sent for all deleted objects." See
    # https://docs.djangoproject.com/en/3.2/ref/models/fields/#django.db.models.CASCADE
    # We want to delete all files when an XForm, an Instance or Attachment object is
    # deleted.
    # Since the Attachment object is deleted with CASCADE, we must use a
    # `pre_delete` signal to access its parent Instance and its parent XForm.
    # Otherwise, with a `post_delete`, they would be gone before reaching the rest
    # of code below.

    # `instance` here means "model instance", and no, it is not allowed to
    # change the name of the parameter
    attachment = instance
    file_size = attachment.media_file_size
    only_update_counters = kwargs.pop('only_update_counters', False)
    xform = attachment.instance.xform

    if file_size and attachment.deleted_at is None:
        with transaction.atomic():
            # Update both counters simultaneously within a transaction to minimize
            # the risk of desynchronization.
            UserProfile.objects.filter(
                user_id=xform.user_id
            ).update(
                attachment_storage_bytes=F('attachment_storage_bytes') - file_size
            )
            XForm.all_objects.filter(pk=xform.pk).update(
                attachment_storage_bytes=F('attachment_storage_bytes') - file_size
            )

    if only_update_counters or not (media_file_name := str(attachment.media_file)):
        return

    # Clean-up storage
    try:
        # We do not want to call `attachment.media_file.delete()` because it calls
        # `attachment.save()` behind the scene which would call again the `post_save`
        # signal below. Bonus: it avoids an extra query 😎.
        default_storage.delete(media_file_name)
        for suffix in settings.THUMB_CONF:
            default_storage.delete(
                get_optimized_image_path(media_file_name, suffix)
            )
    except Exception as e:
        logging.error('Failed to delete attachment: ' + str(e), exc_info=True)


@receiver(post_save, sender=Attachment)
def post_save_attachment(instance, created, **kwargs):
    """
    Update the attachment_storage_bytes field in the UserProfile model
    when an attachment is added
    """
    if not created:
        return
    attachment = instance
    if getattr(attachment, 'defer_counting', False):
        return

    file_size = attachment.media_file_size
    if not file_size:
        return

    xform = attachment.instance.xform

    with transaction.atomic():
        UserProfile.objects.filter(user_id=xform.user_id).update(
            attachment_storage_bytes=F('attachment_storage_bytes') + file_size
        )
        XForm.objects.filter(pk=xform.pk).update(
            attachment_storage_bytes=F('attachment_storage_bytes') + file_size
        )


@receiver(post_save, sender=XForm, dispatch_uid='xform_object_permissions')
def set_object_permissions(sender, instance=None, created=False, **kwargs):
    if created:
        for perm in get_perms_for_model(XForm):
            assign_perm(perm.codename, instance.user, instance)


@receiver(post_delete, sender=XForm, dispatch_uid='update_profile_num_submissions')
def update_profile_num_submissions(sender, instance, **kwargs):
    profile_qs = User.profile.get_queryset()
    try:
        profile = profile_qs.select_for_update().get(
            pk=instance.user.profile.pk
        )
    except ObjectDoesNotExist:
        pass
    else:
        profile.num_of_submissions -= instance.num_of_submissions
        if profile.num_of_submissions < 0:
            profile.num_of_submissions = 0
        profile.save(update_fields=['num_of_submissions'])


@receiver(
    post_delete,
    sender=Instance,
    dispatch_uid='nullify_exports_time_of_last_submission',
)
def nullify_exports_time_of_last_submission(sender, instance, **kwargs):
    """
    Formerly, "deleting" a submission would set a flag on the `Instance`,
    causing the `date_modified` attribute to be set to the current timestamp.
    `Export.exports_outdated()` relied on this to detect when a new `Export`
    needed to be generated due to submission deletion, but now that we always
    delete `Instance`s outright, this trick doesn't work. This kludge simply
    makes every `Export` for a form appear stale by nulling out its
    `time_of_last_submission` attribute.
    """
    if isinstance(instance, Instance):
        try:
            xform = instance.xform
        except XForm.DoesNotExist:  # In case of XForm.delete()
            return
    else:
        xform = instance

    # Avoid circular import
    export_model = xform.export_set.model
    f = xform.export_set.filter(
        # Match the statuses considered by `Export.exports_outdated()`
        internal_status__in=[export_model.SUCCESSFUL, export_model.PENDING],
    )
    f.update(time_of_last_submission=None)


@receiver(
    post_save, sender=Instance, dispatch_uid='update_xform_submission_count'
)
def update_xform_submission_count(sender, instance, created, **kwargs):
    if not created:
        return
    # `defer_counting` is a Python-only attribute
    if getattr(instance, 'defer_counting', False):
        return
    with transaction.atomic():
        xform = XForm.objects.only('user_id').get(pk=instance.xform_id)
        # Update with `F` expression instead of `select_for_update` to avoid
        # locks, which were mysteriously piling up during periods of high
        # traffic
        XForm.objects.filter(pk=instance.xform_id).update(
            num_of_submissions=F('num_of_submissions') + 1,
            last_submission_time=instance.date_created,
        )
        # Hack to avoid circular imports
        UserProfile = User.profile.related.related_model  # noqa
        profile, created = UserProfile.objects.only('pk').get_or_create(
            user_id=xform.user_id
        )
        UserProfile.objects.filter(pk=profile.pk).update(
            num_of_submissions=F('num_of_submissions') + 1,
        )


@receiver(post_save, sender=Instance, dispatch_uid='update_xform_daily_counter')
def update_xform_daily_counter(sender, instance, created, **kwargs):
    if not created:
        return
    if getattr(instance, 'defer_counting', False):
        return

    # get the date submitted
    date_created = instance.date_created.date()

    # make sure the counter exists
    DailyXFormSubmissionCounter.objects.get_or_create(
        date=date_created,
        xform=instance.xform,
        user=instance.xform.user,
    )

    # update the count for the current submission
    DailyXFormSubmissionCounter.objects.filter(
        date=date_created,
        xform=instance.xform,
    ).update(counter=F('counter') + 1)


@receiver(
    post_save, sender=Instance, dispatch_uid='update_xform_monthly_counter'
)
def update_xform_monthly_counter(sender, instance, created, **kwargs):
    if not created:
        return
    if getattr(instance, 'defer_counting', False):
        return

    # get the user_id for the xform the instance was submitted for
    xform = XForm.objects.only('pk', 'user_id').get(pk=instance.xform_id)

    # get the date the instance was created
    date_created = instance.date_created.date()

    # make sure the counter exists
    MonthlyXFormSubmissionCounter.objects.get_or_create(
        user_id=xform.user_id,
        xform=instance.xform,
        year=date_created.year,
        month=date_created.month,
    )

    # update the counter for the current submission
    MonthlyXFormSubmissionCounter.objects.filter(
        xform=instance.xform,
        year=date_created.year,
        month=date_created.month,
    ).update(counter=F('counter') + 1)


@receiver(
    post_delete,
    sender=Instance,
    dispatch_uid='update_xform_submission_count_delete',
)
def update_xform_submission_count_delete(sender, instance, **kwargs):

    value = kwargs.pop('value', 1)

    if isinstance(instance, Instance):
        xform_id = instance.xform_id
        try:
            xform = XForm.objects.only('user_id').get(pk=xform_id)
        except XForm.DoesNotExist:  # In case of XForm.delete()
            return
    else:
        xform_id = instance.pk
        xform = instance

    with transaction.atomic():
        # Like `update_xform_submission_count()`, update with `F` expression
        # instead of `select_for_update` to avoid locks, and `save()` which
        # loads not required fields for these updates.
        XForm.objects.filter(pk=xform_id).update(
            num_of_submissions=Case(
                When(
                    num_of_submissions__gte=value,
                    then=F('num_of_submissions') - value,
                ),
                default=0,
            )
        )
        # Hack to avoid circular imports
        UserProfile = User.profile.related.related_model  # noqa
        UserProfile.objects.filter(user_id=xform.user_id).update(
            num_of_submissions=Case(
                When(
                    num_of_submissions__gte=value,
                    then=F('num_of_submissions') - value,
                ),
                default=0,
            )
        )


# signals are fired during cascade deletion (i.e. deletion initiated by the
# removal of a related object), whereas the `delete()` model method is not
# called. We need call this signal before cascade deletion. Otherwise,
# MonthlySubmissionCounter objects will be deleted before the signal is fired.
pre_delete.connect(
    MonthlyXFormSubmissionCounter.update_catch_all_counter_on_delete,
    sender=XForm,
    dispatch_uid='update_catch_all_monthly_xform_submission_counter',
)

pre_delete.connect(
    DailyXFormSubmissionCounter.update_catch_all_counter_on_delete,
    sender=XForm,
    dispatch_uid='update_catch_all_daily_xform_submission_counter',
)
