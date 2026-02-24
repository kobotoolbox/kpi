from django.db.models import Case, F, When

from kpi.deployment_backends.kc_access.utils import conditional_kc_transaction_atomic
from ...main.models import UserProfile
from ..models import Instance, XForm


def decrement_counters_after_deletion(
    xform_id: int, user_id: int, count: int, storage_bytes: int = 0
):
    """
    Decrement submission count and (optionally) storage bytes for both XForm
    and UserProfile in two UPDATE queries.
    """
    sub_count_decrement = Case(
        When(num_of_submissions__gte=count, then=F('num_of_submissions') - count),
        default=0,
    )
    xform_fields = {'num_of_submissions': sub_count_decrement}
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
        profile_fields['attachment_storage_bytes'] = (
            F('attachment_storage_bytes') - storage_bytes
        )

    with conditional_kc_transaction_atomic():
        XForm.objects.filter(pk=xform_id).update(**xform_fields)
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


def update_storage_counters(xform_id: int, user_id: int, total_bytes: int):

    with conditional_kc_transaction_atomic():
        UserProfile.objects.filter(user_id=user_id).update(
            attachment_storage_bytes=F('attachment_storage_bytes') + total_bytes
        )
        XForm.objects.filter(pk=xform_id).update(
            attachment_storage_bytes=F('attachment_storage_bytes') + total_bytes
        )


def update_user_counters(
    instance: Instance,
    user_id: int,
    attachment_storage_bytes: int = 0,
    increase_num_of_submissions: bool = False,
):
    """
    Update submission and attachment counters for the XForm and its related user profile.

    This function increments the number of submissions and/or the total attachment
    storage size for a given user. If the user's profile does not exist yet, it is
    created automatically to ensure the counters remain consistent.
    """

    fields_to_update = {}
    if increase_num_of_submissions:
        fields_to_update['num_of_submissions'] = F('num_of_submissions') + 1
        fields_to_update['last_submission_time'] = instance.date_created

    if attachment_storage_bytes:
        fields_to_update['attachment_storage_bytes'] = (
            F('attachment_storage_bytes') + attachment_storage_bytes
        )

    with conditional_kc_transaction_atomic():
        # Update related XForm counters
        XForm.objects.filter(pk=instance.xform_id).update(**fields_to_update)

        # Remove `last_submission_time` since it doesn't exist on UserProfile
        fields_to_update.pop('last_submission_time', None)

        # Update related UserProfile counters.
        # If no rows were affected, the profile does not exist yet.
        # Create it first, then re-run the update query.
        if fields_to_update and not UserProfile.objects.filter(user_id=user_id).update(
            **fields_to_update
        ):
            # This only triggers an extra query once per missing profile.
            # It avoids the redundant SELECT we previously used for every
            # new submission.
            UserProfile.objects.only('pk').get_or_create(user_id=instance.xform.user_id)
            UserProfile.objects.filter(user_id=user_id).update(**fields_to_update)
