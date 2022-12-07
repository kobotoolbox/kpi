from django.contrib.auth.models import User
from django.db import models
from django.db.models import F, Q, Value
from django.db.models.constraints import UniqueConstraint
from django.db.models.expressions import Func, RawSQL
from django.db.models.functions import Cast
from django.db.models.signals import post_delete


class MonthlyNLPUsageCounter(models.Model):
    year = models.IntegerField()
    month = models.IntegerField()
    user = models.ForeignKey(User, related_name='users', on_delete=models.DO_NOTHING)
    asset = models.ForeignKey("kpi.asset", null=True, on_delete=models.CASCADE)
    counters = models.JSONField(default=dict)

    class Meta:
        constraints = [
            UniqueConstraint(fields=['year', 'month', 'user', 'asset'],
                             name='unique_with_asset'),
            UniqueConstraint(fields=['year', 'month', 'user'],
                             condition=Q(asset=None),
                             name='unique_without_asset')
        ]
        indexes = [
            models.Index(fields=('year', 'month', 'user')),
        ]

    @classmethod
    def update_catch_all_counter_on_delete(cls, sender, instance, **kwargs):
        criteria = dict(
            year=instance.year,
            month=instance.month,
            user=instance.user,
            asset=None,
        )
        # make sure an instance exists with `asset = NULL`
        cls.objects.get_or_create(**criteria)
        # add the count for the project being deleted to the null-xform
        # instance, atomically!
        counter_keys = instance.counters.keys()
        for service in counter_keys:
            # Updating this way because other methods were messy and less reliable
            # than using the rawSQL method
            sql = f"""
                jsonb_set(
                    counters,
                    '{{{service}}}',
                    (COALESCE(counters->>'{service}','0')::int + {instance.counters[service]})::text::jsonb
                )
            """
            MonthlyNLPUsageCounter.objects.filter(**criteria).update(
                counters=RawSQL(sql, [])
            )


# signals are fired during cascade deletion (i.e. deletion initiated by the
# removal of a related object), whereas the `delete()` model method is not
# called
post_delete.connect(
    MonthlyNLPUsageCounter.update_catch_all_counter_on_delete,
    sender=MonthlyNLPUsageCounter,
    dispatch_uid='update_catch_all_monthly_xform_submission_counter',
)
