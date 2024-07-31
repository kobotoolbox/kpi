# coding: utf-8
from django.db import models
from django.db.models import F, Q
from django.db.models.constraints import UniqueConstraint

from kobo.apps.kobo_auth.shortcuts import User


class MonthlyXFormSubmissionCounter(models.Model):
    year = models.IntegerField()
    month = models.IntegerField()
    user = models.ForeignKey(User, related_name='users', on_delete=models.CASCADE)
    # `xform = NULL` (one per user per month) is used as a catch-all for
    # deleted projects
    xform = models.ForeignKey('logger.XForm', null=True, on_delete=models.CASCADE)
    counter = models.IntegerField(default=0)

    class Meta:
        constraints = [
            UniqueConstraint(fields=['year', 'month', 'user', 'xform'],
                             name='unique_with_xform'),
            UniqueConstraint(fields=['year', 'month', 'user'],
                             condition=Q(xform=None),
                             name='unique_without_xform')
        ]
        indexes = [
            models.Index(fields=('year', 'month', 'user')),
        ]

    @classmethod
    def update_catch_all_counter_on_delete(cls, sender, instance, **kwargs):
        monthly_counters = cls.objects.filter(
            xform_id=instance.pk, counter__gte=1
        )

        for monthly_counter in monthly_counters:
            criteria = dict(
                year=monthly_counter.year,
                month=monthly_counter.month,
                user=monthly_counter.user,
                xform=None,
            )
            # make sure an instance exists with `xform = NULL`
            cls.objects.get_or_create(**criteria)
            # add the count for the project being deleted to the null-xform
            # instance, atomically!
            cls.objects.filter(**criteria).update(
                counter=F('counter') + monthly_counter.counter
            )
