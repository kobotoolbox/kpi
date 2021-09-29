# coding: utf-8
from django.contrib.postgres.fields import JSONField as JSONBField
from django.db import models
from django.utils import timezone

from kpi.fields import KpiUidField


class AnalysisQuestions(models.Model):
    # Is it best to have all analysis questions together, like a mini-form
    # that's attached to a particular question in the main form (asset)?

    # TODO: specify JSON structure. Could be something like:
    """
    [
        {
            "uid": "aq12345", /* kuid? */
            "question_path": "weather_group/What_is_the_weather_like",
            "label": "Transcription", /* maybe ignored for standard types like transcription and translation? */
            "type": "transcription", /* only a few of these */
            "language": "en"
        },
        {
            "uid": "aq12346",
            "question_path": "weather_group/What_is_the_weather_like",
            "label": "Spanish Translation",
            "type": "translation",
            "language": "es"
        }
    ]
    """
    content = JSONBField(default=dict)
    date_created = models.DateTimeField(default=timezone.now)
    date_modified = models.DateTimeField(default=timezone.now)
    uid = KpiUidField(uid_prefix='aqxyz')  # maybe `aq` was fine, but it must differ from the uids inside `content`
    asset = models.ForeignKey('Asset', on_delete=models.CASCADE)

    def save(self, *args, **kwargs):
        if self.pk is not None:
            self.date_modified = timezone.now()
        super().save(*args, **kwargs)


class AnalysisResponses(models.Model):
    # Do we want all the responses together in one object, like a
    # mini-submission to the analysis mini-form?

    # TODO: specify JSON structure. Could be something like:
    """
    {
        "aq12345": "It's cool today and starting to feel like fall. The sky is clear with few clouds.",
        "aq12346": "Empieza a parecer otoño…"
    }
    """
    content = JSONBField(default=dict)
    date_created = models.DateTimeField(default=timezone.now)
    date_modified = models.DateTimeField(default=timezone.now)
    uid = KpiUidField(uid_prefix='ar')
    asset = models.ForeignKey('Asset', on_delete=models.CASCADE)
    submission_id = models.BigIntegerField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if self.pk is not None:
            self.date_modified = timezone.now()
        super().save(*args, **kwargs)
