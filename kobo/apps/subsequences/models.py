# coding: utf-8
from django.db import models

from kpi.models import Asset
from kpi.models.abstract_models import AbstractTimeStampedModel
from .constants import GOOGLETS, GOOGLETX
from .utils.determine_export_cols_with_values import determine_export_cols_indiv


class SubmissionExtras(AbstractTimeStampedModel):

    # FIXME: uuid on the KoboCAT logger.Instance model has max_length 249
    submission_uuid = models.CharField(max_length=40)
    content = models.JSONField(default=dict)
    asset = models.ForeignKey(
        Asset,
        related_name='submission_extras',
        on_delete=models.CASCADE,
    )

    class Meta:
        # ideally `submission_uuid` is universally unique, but its uniqueness
        # per-asset is most important
        unique_together = (('asset', 'submission_uuid'),)

    def save(self, *args, **kwargs):
        # We need to import these here because of circular imports
        from .integrations.google.google_transcribe import GoogleTranscriptionService
        from .integrations.google.google_translate import GoogleTranslationService

        features = self.asset.advanced_features
        for xpath, vals in self.content.items():
            if 'transcript' in features:
                options = vals.get(GOOGLETS, {})
                if options.get('status') == 'requested':
                    service = GoogleTranscriptionService(self)
                    vals[GOOGLETS] = service.process_data(xpath, vals)
            if 'translation' in features:
                options = vals.get(GOOGLETX, {})
                if options.get('status') == 'requested':
                    service = GoogleTranslationService(self)
                    vals[GOOGLETX] = service.process_data(xpath, vals)

        asset_changes = False
        asset_known_cols = self.asset.known_cols
        for kc in determine_export_cols_indiv(self.content):
            if kc not in asset_known_cols:
                asset_changes = True
                asset_known_cols.append(kc)

        if asset_changes:
            self.asset.known_cols = asset_known_cols
            self.asset.save(create_version=False)

        super().save(*args, **kwargs)

    @property
    def full_content(self):
        _content = {}
        _content.update(self.content)
        _content.update({
            'timestamp': str(self.date_created),
        })
        return _content
