from collections import defaultdict

from django.core.exceptions import SuspiciousFileOperation

from kpi.deployment_backends.kc_access.storage import default_kobocat_storage
from kpi.utils.files import normalize_nfc
from kpi.utils.log import logging


def get_attachment_filenames_and_xpaths(
    data: dict, attachment_xpaths: list, child_indexes: dict = None
) -> dict:
    """
    Return a dictionary of all valid attachment filenames of a submission mapped
    to their respective XPath.

    Each value is keyed twice, under the name the client sent and under the
    sanitized forms of it, so that an attachment resolves whether it kept that
    name or only the one Django wrote to storage.
    """

    by_name, by_sanitized_name = _collect_filenames_and_xpaths(
        data, attachment_xpaths, child_indexes
    )

    # Raw names last, so they win. The two families collide as soon as one
    # value is the sanitized form of another, `photo A.jpg` and `photo_A.jpg`
    # both sanitizing to `photo_A.jpg`: merged in this order, that key means
    # the question actually named `photo_A.jpg`, and the other question keeps
    # its own. Merged the other way, or built in a single pass as this used to
    # be, the question read last would take both files.
    return {**by_sanitized_name, **by_name}


def _collect_filenames_and_xpaths(
    data: dict, attachment_xpaths: list, child_indexes: dict = None
) -> tuple[dict, dict]:
    """
    Return the names a submission carries at its media questions, split into
    the ones the client sent and the sanitized ones, so that the caller can
    decide which family outranks the other.

    They have to stay apart until the whole submission has been walked, since
    a value nested in a repeat group can collide with one at the root.
    """

    by_name, by_sanitized_name = {}, {}

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
                    child_names, child_sanitized_names = _collect_filenames_and_xpaths(
                        item_list, attachment_xpaths, child_indexes
                    )
                    by_name.update(child_names)
                    by_sanitized_name.update(child_sanitized_names)

        elif isinstance(value, dict):
            child_names, child_sanitized_names = _collect_filenames_and_xpaths(
                value, attachment_xpaths
            )
            by_name.update(child_names)
            by_sanitized_name.update(child_sanitized_names)
        else:
            if key in attachment_xpaths:
                try:
                    # The name the client sent, unsanitized, which is what
                    # `Attachment.media_file_basename` has held since DEV-897
                    nfc_name = normalize_nfc(value)

                    # The sanitized forms serve every side holding a name Django
                    # already processed: the rows `populate_media_file_basename`
                    # backfilled, and the stored path. Both are kept because
                    # `get_valid_name()` strips the combining marks of an NFD
                    # name, so the two orders do not give the same string.
                    raw_valid_name = default_kobocat_storage.get_valid_name(value)
                    nfc_valid_name = default_kobocat_storage.get_valid_name(nfc_name)
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

                by_name[nfc_name] = key
                by_sanitized_name[nfc_valid_name] = key
                if raw_valid_name != nfc_valid_name:
                    by_sanitized_name[raw_valid_name] = key

    return by_name, by_sanitized_name
