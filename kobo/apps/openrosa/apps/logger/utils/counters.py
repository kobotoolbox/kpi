from django.db.models import Case, F, When

from kpi.deployment_backends.kc_access.utils import conditional_kc_transaction_atomic
from ...main.models import UserProfile
from ..models import Instance, XForm


def decrement_counters_after_deletion(
    xform_id: int, user_id: int, count: int, storage_bytes: int = 0
):
    """
    Decrement the submission count of the XForm and the UserProfile, and
    (optionally) the storage bytes of the XForm, in two UPDATE queries.

    Storage is only counted on the XForm: user storage is the sum of their
    projects. `XForm.all_objects` is used so that a trashed project, whose
    deletion fails and which is then restored, keeps an accurate counter.
    """
    xform_fields = {
        'num_of_submissions': Case(
            When(num_of_submissions__gte=count, then=F('num_of_submissions') - count),
            default=0,
        )
    }
    profile_fields = {
        'num_of_submissions': Case(
            When(num_of_submissions__gte=count, then=F('num_of_submissions') - count),
            default=0,
        )
    }
    if storage_bytes:
        xform_fields['attachment_storage_bytes'] = (
            F('attachment_storage_bytes') - storage_bytes
        )

    with conditional_kc_transaction_atomic():
        XForm.all_objects.filter(pk=xform_id).update(**xform_fields)
        UserProfile.objects.filter(user_id=user_id).update(**profile_fields)


def delete_null_user_daily_counters(apps, *args):
    """
    Find any DailyXFormCounters without a user, assign them to a user if we can,
    otherwise delete them.
    This function is reused between two migrations, logger.0030 and logger.0031.
    If/when those migrations get squashed, please delete this function
    """
    DailyXFormSubmissionCounter = apps.get_model(
        'logger', 'DailyXFormSubmissionCounter'
    )  # noqa

    counters_without_users = DailyXFormSubmissionCounter.objects.filter(user=None)

    if not counters_without_users.exists():
        return

    # Associate each daily counter with user=None with a user based on its xform
    batch = []
    batch_size = 5000
    for counter in (
        counters_without_users.exclude(xform=None)
        .exclude(xform__user=None)
        .iterator(chunk_size=batch_size)
    ):
        counter.user = counter.xform.user
        # don't add a user to duplicate counters, so they get deleted when we're
        # done looping
        if (
            DailyXFormSubmissionCounter.objects.filter(
                date=counter.date, xform=counter.xform
            )
            .exclude(user=None)
            .exists()
        ):
            continue
        batch.append(counter)
        if len(batch) >= batch_size:
            DailyXFormSubmissionCounter.objects.bulk_update(batch, ['user_id'])
            batch = []
    if batch:
        DailyXFormSubmissionCounter.objects.bulk_update(batch, ['user_id'])

    # Delete daily counters without a user to avoid creating invalid monthly counters
    DailyXFormSubmissionCounter.objects.filter(user=None).delete()


def update_storage_counters(storage_bytes_by_xform_id: dict[int, int]):
    """
    Add the bytes of each project (negative to subtract) to its storage
    counter. User storage is the sum of their projects, so there is nothing
    else to update.

    Call it inside the transaction that changed the attachments, as late as
    possible, so the rows stay locked briefly and both are rolled back
    together.
    """

    # A loop rather than `bulk_update()`: a single `UPDATE ... WHERE id IN
    # (...)` locks the rows in whatever order PostgreSQL scans them, so two
    # concurrent calls on the same projects could each hold a row the other
    # waits for, and deadlock. Sorted single-row updates always lock in `pk`
    # order. Calls usually touch one project (API, restore, signals), a few at
    # most (auto-deletion), so the extra round trips are cheap.
    for xform_id, storage_bytes in sorted(storage_bytes_by_xform_id.items()):
        if not storage_bytes:
            continue
        XForm.all_objects.filter(pk=xform_id).update(
            attachment_storage_bytes=F('attachment_storage_bytes') + storage_bytes
        )


def update_user_counters(
    instance: Instance,
    user_id: int,
    attachment_storage_bytes: int = 0,
    increase_num_of_submissions: bool = False,
):
    """
    Update the submission and storage counters of the XForm, and the
    submission counter of its owner's profile.

    Storage is only counted on the XForm: user storage is the sum of their
    projects. If the user's profile does not exist yet, it is created
    automatically to ensure the counters remain consistent.
    """

    xform_fields = {}
    profile_fields = {}
    if increase_num_of_submissions:
        xform_fields['num_of_submissions'] = F('num_of_submissions') + 1
        xform_fields['last_submission_time'] = instance.date_created
        profile_fields['num_of_submissions'] = F('num_of_submissions') + 1

    if attachment_storage_bytes:
        xform_fields['attachment_storage_bytes'] = (
            F('attachment_storage_bytes') + attachment_storage_bytes
        )

    with conditional_kc_transaction_atomic():
        # Update related XForm counters. `all_objects` because the project may
        # be trashed while the submission is being saved, and its counter must
        # still match its attachments if it is restored.
        if xform_fields:
            XForm.all_objects.filter(pk=instance.xform_id).update(**xform_fields)

        # Update related UserProfile counters.
        # If no rows were affected, the profile does not exist yet.
        # Create it first, then re-run the update query.
        if profile_fields and not UserProfile.objects.filter(user_id=user_id).update(
            **profile_fields
        ):
            # This only triggers an extra query once per missing profile.
            # It avoids the redundant SELECT we previously used for every
            # new submission.
            UserProfile.objects.only('pk').get_or_create(user_id=instance.xform.user_id)
            UserProfile.objects.filter(user_id=user_id).update(**profile_fields)
