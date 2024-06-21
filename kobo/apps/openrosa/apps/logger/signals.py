# coding: utf-8
import logging

from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.db.models.signals import (
    post_save,
    pre_delete,
)
from django.dispatch import receiver

from kobo.apps.openrosa.apps.logger.models.attachment import Attachment
from kobo.apps.openrosa.apps.logger.models.xform import XForm
from kobo.apps.openrosa.apps.main.models.user_profile import UserProfile
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
            """
            Update both counters at the same time (in a transaction) to avoid
            desynchronization as much as possible
            """
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
