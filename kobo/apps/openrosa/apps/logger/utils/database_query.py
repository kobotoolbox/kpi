from __future__ import annotations

import json

from kobo.apps.openrosa.apps.viewer.models.parsed_instance import ParsedInstance
from ..exceptions import (
    BuildDbQueriesAttributeError,
    BuildDbQueriesBadArgumentError,
    BuildDbQueriesNoConfirmationProvidedError,
)
from ..models.xform import XForm


def build_db_queries(xform: XForm, request_data: dict) -> tuple[dict, dict]:
    """
    Gets instance ids based on the request payload.
    Useful to narrow down set of instances for bulk actions

    Args:
        xform (XForm)
        request_data (dict)

    Returns:
        tuple(<dict>, <dict>): PostgreSQL filters, Mongo filters.
           They are meant to be used respectively with Django Queryset
           and PyMongo query.

    """

    mongo_query = ParsedInstance.get_base_query(xform.user.username, xform.id_string)
    postgres_query = {'xform_id': xform.id}
    instance_ids = None
    # Remove empty values
    payload = {key_: value_ for key_, value_ in request_data.items() if value_}
    ###################################################
    # Submissions can be retrieve in 3 different ways #
    ###################################################
    # First of all,
    # users cannot send `query` and `submission_ids` in POST/PATCH request
    #
    if all(key_ in payload for key_ in ('query', 'submission_ids')):
        raise BuildDbQueriesBadArgumentError

    # First scenario / Get submissions based on user's query
    try:
        query = payload['query']
    except KeyError:
        pass
    else:
        try:
            query.update(mongo_query)  # Overrides `_userform_id` if exists
        except AttributeError:
            raise BuildDbQueriesAttributeError

        query_kwargs = {'query': json.dumps(query), 'fields': '["_id"]'}

        cursor = ParsedInstance.query_mongo_no_paging(**query_kwargs)
        instance_ids = [record.get('_id') for record in list(cursor)]

    # Second scenario / Get submissions based on list of ids
    try:
        submission_ids = payload['submission_ids']
    except KeyError:
        pass
    else:
        try:
            # Use int() to test if list of integers is valid.
            instance_ids = [int(submission_id) for submission_id in submission_ids]
        except ValueError:
            raise BuildDbQueriesAttributeError

    if instance_ids is not None:
        # Narrow down queries with list of ids.
        postgres_query.update({'id__in': instance_ids})
        mongo_query.update({'_id': {'$in': instance_ids}})
    elif payload.get('confirm', False) is not True:
        # Third scenario / get all submissions in form,
        # but confirmation param must be among payload
        raise BuildDbQueriesNoConfirmationProvidedError

    return postgres_query, mongo_query
