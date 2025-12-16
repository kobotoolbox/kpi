from typing import Any

from .base import ActionClassConfig
from .qual import BaseQualAction


class ManualQualAction(BaseQualAction):

    ID = 'manual_qual'
    action_class_config = ActionClassConfig(
        allow_multiple=True, automatic=False, action_data_key='uuid'
    )

    def overlaps_other_actions(self) -> bool:
        """
        Qual returns a grouped structured block (e.g. {"qual": [...]}) and
        does not participate in per-field arbitration with other actions
        """
        return True

    def transform_data_for_output(self, action_data: dict) -> dict[str, Any]:

        qual_questions_by_uuid = {q['uuid']: q for q in self.params}

        # Choice lookup tables for select questions
        choices_by_uuid = {}
        for qual_question in self.params:
            if qual_question['type'] in ('qualSelectOne', 'qualSelectMultiple'):
                choices_by_uuid[qual_question['uuid']] = {
                    choice['uuid']: choice
                    for choice in qual_question.get('choices', [])
                }

        results_list = []
        for qual_uuid, qual_data in action_data.items():
            if qual_uuid not in qual_questions_by_uuid:
                continue

            qual_question = qual_questions_by_uuid[qual_uuid]

            # Get the most recent accepted version
            versions = qual_data.get(self.VERSION_FIELD, [])
            if not versions:
                continue

            versions_sorted = sorted(
                versions,
                key=lambda x: x.get(self.DATE_ACCEPTED_FIELD, ''),
                reverse=True,
            )
            selected_version = versions_sorted[0]
            if not selected_version.get(self.DATE_ACCEPTED_FIELD):
                continue

            selected_response_data = selected_version.get(self.VERSION_DATA_FIELD, {})
            if not selected_response_data:
                continue

            value = selected_response_data.get('value')
            question_type = qual_question['type']
            if question_type == 'qualSelectOne':
                if value and qual_uuid in choices_by_uuid:
                    choice = choices_by_uuid[qual_uuid].get(value)
                    output_value = {
                        'uuid': value,
                        'labels': choice.get('labels') if choice else {},
                    }
                else:
                    output_value = None
            elif question_type == 'qualSelectMultiple':
                if value and isinstance(value, list) and qual_uuid in choices_by_uuid:
                    output_value = []
                    for choice_uuid in value:
                        choice = choices_by_uuid[qual_uuid].get(choice_uuid)
                        output_value.append(
                            {
                                'uuid': choice_uuid,
                                'labels': choice.get('labels') if choice else {},
                            }
                        )
                else:
                    output_value = []
            else:
                # Unchanged value for other types (integer, text, tags)
                output_value = value

            results_list.append(
                {
                    'val': output_value,
                    'type': qual_question['type'],
                    'uuid': qual_uuid,
                    'xpath': self.source_question_xpath,
                    'labels': qual_question.get('labels', {}),
                }
            )
        return {'qual': results_list}
