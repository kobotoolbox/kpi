from django.db import models
from django.db.models import Q
from django.db.models.constraints import UniqueConstraint
from django.db.models.signals import post_delete

from kobo.apps.kobo_auth.shortcuts import User
from .utils import update_nlp_counter


class NLPUsageCounter(models.Model):
    date = models.DateField()
    user = models.ForeignKey(
        User, related_name='nlp_counters', on_delete=models.CASCADE
    )
    asset = models.ForeignKey('kpi.asset', null=True, on_delete=models.CASCADE)
    counters = models.JSONField(default=dict)
    total_asr_seconds = models.PositiveIntegerField(default=0)
    total_mt_characters = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            UniqueConstraint(
                fields=['date', 'user', 'asset'], name='unique_with_asset'
            ),
            UniqueConstraint(
                fields=['date', 'user'],
                condition=Q(asset=None),
                name='unique_without_asset',
            ),
        ]
        indexes = [
            models.Index(fields=('date', 'user')),
        ]

    @classmethod
    def update_catch_all_counters_on_delete(cls, sender, instance, **kwargs):
        criteria = dict(
            date=instance.date,
            user_id=instance.user_id,
            asset=None,
        )
        # make sure an instance exists with `asset = NULL`
        counter, _ = cls.objects.get_or_create(**criteria)

        # add the count for the project being deleted to the null-xform
        # instance, atomically!
        for service in instance.counters.keys():
            update_nlp_counter(
                service,
                amount=instance.counters[service],
                user_id=instance.user_id,
                counter_id=counter.pk,
            )


# signals are fired during cascade deletion (i.e. deletion initiated by the
# removal of a related object), whereas the `delete()` model method is not
# called
post_delete.connect(
    NLPUsageCounter.update_catch_all_counters_on_delete,
    sender=NLPUsageCounter,
    dispatch_uid='update_catch_all_monthly_xform_submission_counters',
)
