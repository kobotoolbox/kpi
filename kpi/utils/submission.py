from collections import defaultdict

from django.core.exceptions import SuspiciousFileOperation

from kpi.deployment_backends.kc_access.storage import default_kobocat_storage
from kpi.utils.log import logging


def get_attachment_filenames_and_xpaths(
    data: dict, attachment_xpaths: list, child_indexes: dict = None
) -> dict:
    """
    Return a dictionary of all valid attachment filenames of a submission mapped
    to their respective XPath.
    """

    return_dict = {}
    for key, value in data.items():

        if not child_indexes:
            child_indexes = defaultdict(int)

        if isinstance(value, list):
            for index, item_list in enumerate(value):
                if isinstance(item_list, dict):
                    # `child_indexes` is mutable and is mutated while descending
                    # in nested groups (i.e. calling this function recursively)
                    # to keep a trace of each (parent) group index
                    child_indexes[key] = index + 1
                    return_dict.update(
                        get_attachment_filenames_and_xpaths(
                            item_list, attachment_xpaths, child_indexes
                        )
                    )

        elif isinstance(value, dict):
            return_dict.update(
                get_attachment_filenames_and_xpaths(value, attachment_xpaths)
            )
        else:
            if key in attachment_xpaths:
                try:
                    value = default_kobocat_storage.get_valid_name(value)
                except SuspiciousFileOperation:
                    logging.error(f'Could not get valid name from {value}')
                    continue
                if child_indexes:
                    # `key` only contains the XPath with groups without any
                    # index. Recreate XPath with correct indexes found in `
                    # child_indexes`
                    for group_name, group_index in child_indexes.items():
                        # Only apply index on the deepest nested group name
                        # `group_name` could be:
                        #   parent_group/nested_group/nested_nested_group
                        group = group_name.split('/')[-1]
                        key = key.replace(group, f'{group}[{group_index}]')

                return_dict[value] = key

    return return_dict
