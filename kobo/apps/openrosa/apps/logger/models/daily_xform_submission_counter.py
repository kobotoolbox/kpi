from django.db import models
from django.db.models import UniqueConstraint, Q, F

from kobo.apps.kobo_auth.shortcuts import User


class DailyXFormSubmissionCounter(models.Model):
    date = models.DateField()
    user = models.ForeignKey(User, related_name='daily_counts', on_delete=models.CASCADE)
    xform = models.ForeignKey(
        'logger.XForm', related_name='daily_counters', null=True, on_delete=models.CASCADE
    )
    counter = models.IntegerField(default=0)

    class Meta:
        constraints = [
            UniqueConstraint(fields=['date', 'user', 'xform'],
                             name='daily_unique_with_xform'),
            UniqueConstraint(fields=['date', 'user'],
                             condition=Q(xform=None),
                             name='daily_unique_without_xform')
        ]
        indexes = [
            models.Index(fields=('date', 'user')),
        ]

    @classmethod
    def update_catch_all_counter_on_delete(cls, sender, instance, **kwargs):
        daily_counters = cls.objects.filter(
            xform_id=instance.pk, counter__gte=1
        )

        for daily_counter in daily_counters:
            criteria = dict(
                date=daily_counter.date,
                user=daily_counter.user,
                xform=None,
            )
            # make sure an instance exists with `xform = NULL`
            cls.objects.get_or_create(**criteria)
            # add the count for the project being deleted to the null-xform
            # instance, atomically!
            cls.objects.filter(**criteria).update(
                counter=F('counter') + daily_counter.counter
            )
