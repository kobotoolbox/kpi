import re
import xml.etree.ElementTree as ET
from typing import Callable, Iterable

from formpack.constants import FUZZY_VERSION_RE

from kobo.apps.openrosa.libs.utils.common_tags import VERSION
from kpi.fields.kpi_uid import UUID_LENGTH

# A KPI `AssetVersion` uid: the `v` prefix of its `KpiUidField`, then exactly
# `UUID_LENGTH` characters from `shortuuid`'s alphabet, which is alphanumeric.
# Anything else is discarded rather than written back into the document
version_uid_regex = re.compile(rf'^v[A-Za-z0-9]{{{UUID_LENGTH}}}$')


def get_collected_version_uid(
    xml_parsed: ET.Element, load_version_ids: Callable[[], dict[str, str]]
) -> str | None:
    """
    Return the uid of the version that a submission was collected with, or `None`
    when it names no version at all.

    A submission declares it in `__version__`, and that is all a recent one
    carries, so it is trusted as is, without `load_version_ids()` being called:
    this runs on every submission received.

    Old ones may carry several version nodes, e.g. `_version_` and
    `_version__001`, left behind by kobotoolbox/kpi#1465, where `__version__`
    holds the *oldest* version and the newest one is the right one. Some name
    their version by a deprecated reversion id or an alias. Those are resolved
    the way `build_formpack()` does, through the ids `load_version_ids()`
    returns, see `infer_version_uid()`.

    Only top-level nodes are read: KPI always appends the version row at the
    end of the survey, so a node of that name inside a group is a question.

    Note: a `__version__` alone that holds an alias, the uid of a version
    merged into another one in 2017, is returned as it is, since telling it
    apart would mean loading the versions for every submission. A caller that
    has them at hand resolves it, as `rebuild_form_versions()` does.
    """

    named = {}
    for child in xml_parsed:
        # `__version__`, `_version_`, `_version__001`..., and never a question
        # merely named like one, e.g. `nb_version_`
        if FUZZY_VERSION_RE.match(child.tag) and (text := (child.text or '').strip()):
            named[child.tag] = text

    if not named:
        return None

    if list(named) == [VERSION] and version_uid_regex.match(named[VERSION]):
        return named[VERSION]

    return infer_version_uid(named.values(), load_version_ids())


def get_version_ids(versions: Iterable[dict]) -> dict[str, str]:
    """
    Map every id that a version is known by, its `uid`, its `uid_aliases` and its
    deprecated `_reversion_version`, to its uid, newest version first.

    `versions` holds those three keys for each version, newest first.
    """

    version_ids = {}

    for version in versions:
        ids = [version['uid'], *(version.get('uid_aliases') or [])]
        if version.get('_reversion_version') is not None:
            ids.append(str(version['_reversion_version']))

        for version_id in ids:
            version_ids.setdefault(version_id, version['uid'])

    return version_ids


def infer_version_uid(named_ids: Iterable, version_ids: dict[str, str]) -> str | None:
    """
    Return the uid of the newest version among `named_ids`, the values of
    every version node of a submission, or `None` when none of them is one of
    `version_ids`, see `get_version_ids()`.

    A submission often holds several version nodes with different ids
    (kobotoolbox/kpi#1465), so the newest version that it names is assumed to be the
    one that it was collected with.
    """

    named = {str(named_id).strip() for named_id in named_ids}

    for version_id, uid in version_ids.items():
        if version_id in named:
            return uid

    return None


def load_deployed_version_ids(asset_uid: str) -> dict[str, str]:
    """
    Return `get_version_ids()` for every deployed version of the asset.
    """

    # Imported here because `kpi.models` reaches back into the apps using this
    from kpi.models import AssetVersion

    return get_version_ids(
        AssetVersion.objects.filter(asset__uid=asset_uid, deployed=True)
        .order_by('-date_modified')
        .values('uid', 'uid_aliases', '_reversion_version')
    )
