from django.test import SimpleTestCase

from kpi.utils.form_versions import (
    get_collected_version_uid,
    get_version_ids,
    infer_version_uid,
)
from kpi.utils.xml import fromstring_preserve_root_xmlns

VERSION_1 = 'v' + '1' * 21
VERSION_2 = 'v' + '2' * 21
VERSION_3 = 'v' + '3' * 21

# Newest first, the way every caller hands them over
VERSIONS = [
    {'uid': VERSION_3, 'uid_aliases': None, '_reversion_version': None},
    {'uid': VERSION_2, 'uid_aliases': ['anOldAlias'], '_reversion_version': None},
    {'uid': VERSION_1, 'uid_aliases': None, '_reversion_version': 42},
]
VERSION_IDS = get_version_ids(VERSIONS)


def submission(*version_nodes: tuple[str, str]):
    nodes = ''.join(f'<{tag}>{value}</{tag}>' for tag, value in version_nodes)

    return fromstring_preserve_root_xmlns(
        f'<aForm id="aForm"><q1>hello</q1>{nodes}'
        '<meta><instanceID>uuid:1</instanceID></meta></aForm>'
    )


class GetCollectedVersionUidTestCase(SimpleTestCase):

    def test_a_recent_submission_is_read_without_loading_any_version(self):
        """
        This runs on every submission received, and a recent one names its
        version in `__version__` alone.
        """

        def load_version_ids():
            raise AssertionError('The versions should not be loaded')

        assert (
            get_collected_version_uid(
                submission(('__version__', VERSION_1)), load_version_ids
            )
            == VERSION_1
        )

    def test_a_submission_naming_no_version_has_none(self):
        assert get_collected_version_uid(submission(), lambda: VERSION_IDS) is None

    def test_the_newest_of_several_version_nodes_wins(self):
        """
        kobotoolbox/kpi#1465 left `__version__` holding the oldest version, and
        the version the submission was collected with in a suffixed node.
        """

        xml_parsed = submission(
            ('__version__', VERSION_1),
            ('_version_', VERSION_2),
            ('_version__001', VERSION_3),
        )

        assert get_collected_version_uid(xml_parsed, lambda: VERSION_IDS) == VERSION_3

    def test_a_version_named_under_another_key_alone(self):
        assert (
            get_collected_version_uid(
                submission(('_version_', VERSION_2)), lambda: VERSION_IDS
            )
            == VERSION_2
        )

    def test_a_reversion_id_or_an_alias_resolves_to_its_uid(self):
        for legacy_id, expected in (('42', VERSION_1), ('anOldAlias', VERSION_2)):
            assert (
                get_collected_version_uid(
                    submission(('__version__', legacy_id)), lambda: VERSION_IDS
                )
                == expected
            ), legacy_id

    def test_a_question_inside_a_group_is_not_a_version(self):
        xml_parsed = fromstring_preserve_root_xmlns(
            f'<aForm id="aForm"><group><_version_>{VERSION_2}</_version_></group>'
            f'<__version__>{VERSION_1}</__version__></aForm>'
        )

        def load_version_ids():
            raise AssertionError('The versions should not be loaded')

        assert get_collected_version_uid(xml_parsed, load_version_ids) == VERSION_1

    def test_a_question_merely_named_like_a_version_node_is_not_one(self):
        """
        Its answer may well equal a reversion id, a small integer, and would
        then pass for the newest version. The versions are not even loaded.
        """

        def load_version_ids():
            raise AssertionError('The versions should not be loaded')

        xml_parsed = submission(('__version__', VERSION_1), ('nb_version_', '42'))

        assert get_collected_version_uid(xml_parsed, load_version_ids) == VERSION_1


class InferVersionUidTestCase(SimpleTestCase):

    def test_returns_none_when_no_id_is_a_known_version(self):
        assert infer_version_uid(['vUnknown', 'an answer'], VERSION_IDS) is None

    def test_reads_a_reversion_id_stored_as_a_number(self):
        assert infer_version_uid([42], VERSION_IDS) == VERSION_1
