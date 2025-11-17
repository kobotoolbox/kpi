from django.db import transaction

from ..constants import SCHEMA_VERSIONS, Action
from ..models import QuestionAdvancedAction
from ...openrosa.apps.logger.models import XForm
from ...openrosa.apps.logger.xform_instance_parser import get_abbreviated_xpath


def migrate_advanced_features(asset: 'kpi.models.Asset') -> dict | None:
    advanced_features = asset.advanced_features
    known_cols = set([col.split(":")[0] for col in asset.known_cols])

    if advanced_features == {}:
        return

    xform = XForm.objects.get(kpi_asset_uid=asset.uid)

    with transaction.atomic():
        for key, value in advanced_features.items():
            if (
                key == 'transcript'
                and value
                and 'languages' in value
                and value['languages']
            ):
                for q in known_cols:
                    QuestionAdvancedAction.objects.create(
                        question_xpath=get_abbreviated_xpath(q),
                        asset=asset,
                        action=Action.MANUAL_TRANSCRIPTION,
                        params=[
                            {'language': language} for language in value['languages']
                        ]
                    )

            if (
                key == 'translation'
                and value
                and 'languages' in value
                and value['languages']
            ):
                for q in known_cols:
                    QuestionAdvancedAction.objects.create(
                        question_xpath=get_abbreviated_xpath(q),
                        asset=asset,
                        action=Action.MANUAL_TRANSCRIPTION,
                        params=[
                            {'language': language} for language in value['languages']
                        ]
                    )
            if key == 'qual':
                # TODO: DEV-1295
                pass
        asset.advanced_features = {}
        asset.save(update_fields=['advanced_features'], adjust_content=False)



