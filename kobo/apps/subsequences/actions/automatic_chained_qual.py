from kobo.apps.subsequences.actions.base import ActionClassConfig, BaseAction


class AutomaticChainedQualAction(BaseAction):

    ID = 'automatic_chained_qual'
    action_class_config = ActionClassConfig(
        allow_multiple=True, automatic=True, action_data_key='uuid'
    )
