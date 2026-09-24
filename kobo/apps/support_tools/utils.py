import bisect
from datetime import datetime

from kobo.apps.openrosa.libs.utils import common_tags
from kobo.apps.openrosa.libs.utils.logger_tools import _get_form_versions
from kpi.utils.xml import fromstring_preserve_root_xmlns


def rebuild_form_versions(
    xml: str,
    date_created: datetime,
    histories: list[tuple[str, datetime]],
    deployed_versions: list[tuple[datetime, str]],
) -> str | None:
    """
    Return the `meta/formVersions` a submission should carry, rebuilt from its
    edit history, for submissions written before `add_form_versions()` existed.

    Each write is replayed the way `add_form_versions()` would have seen it:
    the version the incoming XML declares, then the version deployed when it
    arrived. The first write is the submission itself, received at
    `date_created`. Each edit is known through its `InstanceHistory` row, which
    holds the XML as it was *before* that edit and was created when the edit
    came in, so the XML an edit brought is the next snapshot, or the current
    XML for the last one.

    `histories` is the list of `(xml, date_created)` of those rows, oldest
    first. `deployed_versions` is the list of `(date, uid)` of the asset's
    deployed versions, oldest first.

    Whatever the submission already records is kept: the result can only add
    versions, never drop one. Versions are ordered oldest first by deployment
    date; a uid the asset does not know keeps its place, ahead of the others.

    `None` means there is nothing to write: fewer than two versions, or exactly
    what the submission already records.
    """

    snapshots = [history_xml for history_xml, _ in histories] + [xml]
    received_dates = [date_created] + [edited_at for _, edited_at in histories]

    form_versions = []
    xml_parsed = None

    for snapshot, received_at in zip(snapshots, received_dates):
        xml_parsed = fromstring_preserve_root_xmlns(snapshot)
        recorded, submission_version = _get_form_versions(xml_parsed)
        deployed_version = _get_deployed_version_at(deployed_versions, received_at)

        for version_uid in [*recorded, submission_version, deployed_version]:
            if version_uid and version_uid not in form_versions:
                form_versions.append(version_uid)

    # The loop ends on the current XML
    recorded_element = xml_parsed.find(common_tags.META_FORM_VERSIONS)
    recorded_text = recorded_element.text if recorded_element is not None else None

    if len(form_versions) < 2:
        return None

    # `sort()` is stable, so unknown uids keep their relative order
    deployment_rank = {uid: rank for rank, (_, uid) in enumerate(deployed_versions)}
    form_versions.sort(key=lambda uid: deployment_rank.get(uid, -1))
    form_versions_text = ' '.join(form_versions)

    if form_versions_text == recorded_text:
        return None

    return form_versions_text


def _get_deployed_version_at(
    deployed_versions: list[tuple[datetime, str]], when: datetime
) -> str | None:
    """
    Return the uid of the version that was deployed at `when`, i.e. the most
    recent one deployed at or before it, or `None` before the first deployment.

    `deployed_versions` is the list of `(date, uid)`, oldest first.
    """

    index = bisect.bisect_right(deployed_versions, when, key=lambda item: item[0])
    if not index:
        return None

    return deployed_versions[index - 1][1]
