from kobo.apps.reports.constants import FUZZY_VERSION_ID_KEY


def find_matching_version_uid(
    submission,
    version_uids_newest_first,
    reversion_map=None,
    alias_to_primary=None,
):
    """
    Return the latest extant `AssetVersion` UID for a given `submission` or
    `None` if nothing matches.

    A submission often contains many version keys, e.g. `__version__`,
    `_version_`, `_version__001`, `_version__002`, each with a different
    version UID (see https://github.com/kobotoolbox/kpi/issues/1465). To cope,
    assume that the newest version of this asset whose UID (or alias thereof,
    when `alias_to_primary` is provided) appears in the submission is the
    proper one to use.

    When `reversion_map` is provided, replace any deprecated reversion IDs with
    the UIDs of their corresponding AssetVersions.
    """

    submission_version_ids = [
        val for key, val in submission.items() if FUZZY_VERSION_ID_KEY in key and val
    ]

    if reversion_map:
        submission_version_ids = [
            reversion_map.get(vid, vid) for vid in submission_version_ids
        ]

    for known_id in version_uids_newest_first:
        if known_id in submission_version_ids:
            if alias_to_primary:
                return alias_to_primary.get(known_id, known_id)
            return known_id

    return None
