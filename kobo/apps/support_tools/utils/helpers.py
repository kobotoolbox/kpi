import bisect
from datetime import datetime

from kobo.apps.openrosa.apps.logger.models import XForm
from kobo.apps.openrosa.libs.utils import common_tags
from kobo.apps.openrosa.libs.utils.logger_tools import _get_form_versions
from kobo.apps.support_tools.utils.logger import DEBUG
from kpi.utils.form_versions import get_collected_version_uid, get_version_ids
from kpi.utils.xml import fromstring_preserve_root_xmlns


def get_project_xform(asset_uid: str) -> XForm:
    """
    Return the form that a project is deployed as, or explain why it has none.
    """

    # Imported here because `kpi.models` reaches back into this app
    from kpi.models import Asset

    try:
        asset = Asset.objects.defer('content').get(uid=asset_uid)
    except Asset.DoesNotExist:
        raise ValueError(f'Asset `{asset_uid}` does not exist')

    if not asset.has_deployment:
        raise ValueError(f'Asset `{asset_uid}` is not deployed')

    return asset.deployment.xform


def rebuild_form_versions(
    xml: str,
    date_created: datetime,
    histories: list[tuple[str, datetime]],
    deployed_versions: list[dict],
    log: callable = None,
) -> str | None:
    """
    Return the `meta/formVersions` a submission should carry, rebuilt from its
    edit history, for submissions written before `add_form_versions()` existed.

    Each write is replayed the way `add_form_versions()` would have seen it:
    the version that the incoming XML was collected with, then, for an edit only,
    the version deployed when it arrived. The first write is the submission
    itself, received at `date_created`. Each edit is known through its
    `InstanceHistory` row, which holds the XML as it was *before* that edit and
    was created when the edit came in, so the XML that an edit brought is the next
    snapshot, or the current XML for the last one.

    The version that a write was collected with is read by
    `get_collected_version_uid()`, the same way `add_form_versions()` and
    formpack do, since old submissions do not always declare it in
    `__version__` alone.

    `histories` is the list of `(xml, date_created)` of those rows, oldest
    first. `deployed_versions` holds the `uid`, `uid_aliases`,
    `_reversion_version` and `date_modified` of the asset's deployed versions,
    oldest first.

    Whatever the submission already records is kept: the result can only add
    versions, never drop one, although an alias it records is replaced by the
    uid of the version that it stands for. Versions are ordered oldest first by
    deployment date; a uid that the asset does not know keeps its place, ahead of
    the others.

    `None` means there is nothing to write: only the version deployed at the
    last write, no way to tell it apart, or exactly what the submission
    already records. A submission collected offline with an older version and
    never edited gets that version alone, since its fields are looked up in
    `meta/formVersions`.

    `log`, a `RestoreLogger`, is told every step at the `DEBUG` level.
    """

    log = log or (lambda message, level=None: None)

    snapshots = [history_xml for history_xml, _ in histories] + [xml]
    received_dates = [date_created] + [edited_at for _, edited_at in histories]
    version_ids = get_version_ids(reversed(deployed_versions))

    form_versions = []
    xml_parsed = None
    deployed_version = None

    for step, (snapshot, received_at) in enumerate(zip(snapshots, received_dates)):
        xml_parsed = fromstring_preserve_root_xmlns(snapshot)
        recorded, _ = _get_form_versions(xml_parsed)
        submission_version = get_collected_version_uid(xml_parsed, lambda: version_ids)
        # `__version__` alone is trusted without the asset's versions, which
        # are at hand here: an alias, the uid of a version merged into another
        # one, is resolved to that one, and a uid that the asset does not know is
        # kept as it is
        recorded = [version_ids.get(uid, uid) for uid in recorded]
        submission_version = version_ids.get(submission_version, submission_version)
        deployed_version = _get_deployed_version_at(deployed_versions, received_at)

        # The deployed version only comes in with an edit, whose answers are
        # the ones that the deployed form asks for. A submission collected offline
        # gave none of its answers against it
        brought_in = [*recorded, submission_version]
        if step:
            brought_in.append(deployed_version)

        for version_uid in brought_in:
            if version_uid and version_uid not in form_versions:
                form_versions.append(version_uid)

        write = 'created' if step == 0 else f'edit #{step}'
        source = 'current XML' if step == len(histories) else f'history #{step}'
        log(
            f'  {write} at {received_at.isoformat()} ({source}):'
            f' recorded={recorded} __version__={submission_version}'
            f' deployed={deployed_version} -> {form_versions}',
            DEBUG,
        )

    # The loop ends on the current XML
    recorded_element = xml_parsed.find(common_tags.META_FORM_VERSIONS)
    recorded_text = recorded_element.text if recorded_element is not None else None

    if len(form_versions) < 2 and (
        not deployed_version or form_versions in ([], [deployed_version])
    ):
        log('  nothing to record, the deployed version alone', DEBUG)
        return None

    # `sort()` is stable, so unknown uids keep their relative order
    deployment_rank = {
        version['uid']: rank for rank, version in enumerate(deployed_versions)
    }
    form_versions.sort(key=lambda uid: deployment_rank.get(uid, -1))
    form_versions_text = ' '.join(form_versions)

    if form_versions_text == recorded_text:
        log('  nothing to record, already up to date', DEBUG)
        return None

    return form_versions_text


def _get_deployed_version_at(
    deployed_versions: list[dict], when: datetime
) -> str | None:
    """
    Return the uid of the version that was deployed at `when`, i.e. the most
    recent one deployed at or before it, or `None` before the first deployment.

    `deployed_versions` holds the `uid` and `date_modified` of each deployed
    version, oldest first.
    """

    index = bisect.bisect_right(
        deployed_versions, when, key=lambda version: version['date_modified']
    )
    if not index:
        return None

    return deployed_versions[index - 1]['uid']
