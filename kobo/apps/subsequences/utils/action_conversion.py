from kobo.apps.subsequences.actions import ACTION_IDS_TO_CLASSES


def question_advanced_action_to_action(qaa) :
        action_class = ACTION_IDS_TO_CLASSES[qaa.action]
        return action_class(
            source_question_xpath=qaa.question_xpath,
            params=qaa.params,
            asset=qaa.asset,
        )
