from __future__ import annotations

from typing import Any, Dict, Iterable, List

from django.db import transaction

from ..constants import Action
from ..models import QuestionAdvancedAction


def convert_qual_params(
    asset: Any, qualdict: Dict[str, Any]
) -> List[QuestionAdvancedAction]:
    """Convert a qual dict (from `Asset.advanced_features['qual']`) into
    `QuestionAdvancedAction` objects grouped by `xpath`.

    Returns the list of created/updated `QuestionAdvancedAction` instances.
    """
    if not qualdict:
        return []

    qual_survey = qualdict.get('qual_survey')
    if not isinstance(qual_survey, Iterable):
        return []

    groups: Dict[str, List[Dict[str, Any]]] = {}
    for item in qual_survey:
        if not isinstance(item, dict):
            continue
        xpath = item.get('xpath') or item.get('qpath')
        if not xpath:
            continue
        groups.setdefault(xpath, []).append(item)

    created_objs: List[QuestionAdvancedAction] = []
    with transaction.atomic():
        for xpath, items in groups.items():
            obj, _ = QuestionAdvancedAction.objects.update_or_create(
                asset=asset,
                action=Action.QUAL,
                question_xpath=xpath,
                defaults={'params': list(items)},
            )
            created_objs.append(obj)

    return created_objs
