# coding: utf-8
from django.contrib.postgres.fields import JSONField as JSONBField
from django.db import models
from django.utils import timezone

from kpi.fields import KpiUidField


# FIXME: Rename!
class DraftNLPModel(models.Model):
    TRANSCRIPT = 'transcript'
    TRANSLATION = 'translation'

    ### Future ###

    # All coding questions together, like a mini-form that's attached to a
    # particular question in the main form (asset)
    # CODING_QUESTIONS = 'coding_questions'

    # Do we want all the responses together in one object, like a
    # mini-submission to the coding mini-form?
    # CODING_RESPONSES = 'coding_responses'

    TYPE_CHOICES = (
        (TRANSCRIPT, TRANSCRIPT),
        (TRANSLATION, TRANSLATION),
        # Future
        # (CODING_QUESTIONS, CODING_QUESTIONS),
        # (CODING_RESPONSES, CODING_RESPONSES),
    )

    content = JSONBField(default=dict)
    date_created = models.DateTimeField(default=timezone.now)
    date_modified = models.DateTimeField(default=timezone.now)
    draft_nlp_type = models.CharField(choices=TYPE_CHOICES, max_length=32)
    uid = KpiUidField(uid_prefix='draft_nlp')

    asset = models.ForeignKey(
        'Asset', related_name='draft_nlp_instances', on_delete=models.CASCADE
    )
    parent = models.ForeignKey(
        'DraftNLPModel',
        related_name='children',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    question_path = models.CharField(max_length=2048, blank=True, default='')
    submission_id = models.BigIntegerField(null=True, blank=True)

    """
    Relation examples:
    * If I'm a transcript, I'm related to an asset, a question_path, and a
        submission_id.
    * If I'm a translation, I'm related to an asset and a transcript (where
        transcript is an instance of the same model, stored in `parent`). If
        denormalization is helpful, I could also store my question_path and
        submission_id.
    * If I'm a set of coding questions, I'm related to an asset and a
        question_path.
    * If I'm a set of coding responses, I'm related to an asset, a set of
        coding questions (`parent`), and a submission_id, plus further
        denormalization if desired.
    """

    def save(self, *args, **kwargs):
        if self.pk is not None:
            self.date_modified = timezone.now()
        super().save(*args, **kwargs)
