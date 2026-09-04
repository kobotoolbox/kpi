import io
import json
import uuid as uuid_module
from types import SimpleNamespace

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.exceptions import DuplicateInstanceError
from kobo.apps.openrosa.apps.logger.models import Instance, XForm
from kobo.apps.openrosa.apps.logger.models.instance import InstanceHistory
from kobo.apps.openrosa.apps.logger.xform_instance_parser import strip_form_versions
from kobo.apps.openrosa.apps.main.models import UserProfile
from kobo.apps.openrosa.libs.utils import common_tags
from kobo.apps.openrosa.libs.utils.common_tags import (
    META_FORM_VERSIONS,
    VERSION,
)
from kobo.apps.openrosa.libs.utils.logger_tools import (
    add_form_versions,
    create_instance,
)
from kpi.utils.xml import (
    edit_submission_xml,
    fromstring_preserve_root_xmlns,
    xml_tostring,
)

ID_STRING = 'aVersionedForm'
FORM_UUID = '7117fdf814234f5ea0c9f5801b022293'
# KPI `AssetVersion` uids are a `v` prefix followed by 21 characters
VERSION_1 = 'v' + '1' * 21
VERSION_2 = 'v' + '2' * 21
VERSION_3 = 'v' + '3' * 21


def xform_xml() -> str:
    return (
        '<?xml version="1.0" encoding="utf-8"?>'
        '<h:html xmlns="http://www.w3.org/2002/xforms"'
        ' xmlns:h="http://www.w3.org/1999/xhtml"'
        ' xmlns:jr="http://openrosa.org/javarosa">'
        '<h:head>'
        f'<h:title>{ID_STRING}</h:title>'
        '<model>'
        '<instance>'
        f'<{ID_STRING} id="{ID_STRING}">'
        '<formhub><uuid/></formhub>'
        '<q1/>'
        '<__version__/>'
        '<meta><instanceID/><deprecatedID/><rootUuid/></meta>'
        f'</{ID_STRING}>'
        '</instance>'
        f'<bind nodeset="/{ID_STRING}/meta/instanceID" type="string"/>'
        '</model>'
        '</h:head>'
        '<h:body/>'
        '</h:html>'
    )


def xform_json(version_uid: str | None) -> str:
    """
    Build the pyxform JSON of a form deployed by KPI at `version_uid`.

    Pass `None` to describe a form that was not deployed by KPI, i.e. one
    without the `__version__` calculate row.
    """

    children = [{'name': 'q1', 'type': 'text'}]
    if version_uid:
        children.append(
            {
                'name': VERSION,
                'type': 'calculate',
                'bind': {'calculate': f"'{version_uid}'"},
            }
        )

    return json.dumps(
        {
            'default_language': 'default',
            'id_string': ID_STRING,
            'name': ID_STRING,
            'title': ID_STRING,
            'type': 'survey',
            'children': children,
        }
    )


def submission_xml(
    version_uid: str | None = VERSION_1,
    instance_id: str = 'uuid:55d873b2-3a25-4370-8cd9-c41ed4156d07',
    declaration: bool = False,
    form_versions: str | None = None,
    deprecated_id: str | None = None,
) -> str:
    """
    Build a submission.

    `form_versions` is what the client claims. It is never trusted on its own:
    `add_form_versions()` takes the history from `previous_xml`, so use that to
    describe the record being edited.
    """

    version_node = f'<__version__>{version_uid}</__version__>' if version_uid else ''
    form_versions_node = (
        f'<formVersions>{form_versions}</formVersions>' if form_versions else ''
    )
    deprecated_id_node = (
        f'<deprecatedID>{deprecated_id}</deprecatedID>' if deprecated_id else ''
    )
    return (
        ('<?xml version="1.0" encoding="utf-8"?>' if declaration else '')
        + f'<{ID_STRING} id="{ID_STRING}">'
        f'<formhub><uuid>{FORM_UUID}</uuid></formhub>'
        '<q1>hello</q1>'
        f'{version_node}'
        f'<meta><instanceID>{instance_id}</instanceID>'
        f'{deprecated_id_node}{form_versions_node}</meta>'
        f'</{ID_STRING}>'
    )


def get_form_versions(xml: str) -> str | None:
    element = fromstring_preserve_root_xmlns(xml).find(META_FORM_VERSIONS)
    return None if element is None else element.text


class TestDeployedVersionUid(TestCase):
    """
    Unit tests for the version baked into an XForm by KPI at deploy time.
    """

    def test_returns_the_uid_of_the_version_the_form_was_deployed_from(self):
        xform = XForm(json=xform_json(VERSION_1))
        assert xform.deployed_version_uid == VERSION_1

    def test_returns_none_when_no_version_can_be_determined(self):
        xform = XForm(json=xform_json(None))
        assert xform.deployed_version_uid is None

    def test_returns_none_when_the_form_json_is_unusable(self):
        assert XForm(json='').deployed_version_uid is None
        assert XForm(json='{}').deployed_version_uid is None

    def test_falls_back_to_the_asset_when_the_row_is_missing(self):
        """
        Forms deployed before KPI started appending the `__version__` row still
        belong to an asset that knows its latest deployed version.
        """

        xform = XForm(json=xform_json(None), kpi_asset_uid='aSomeAsset')
        # `XForm.asset` memoises on `_cached_asset`, so seeding it stands in for
        # a form whose `kpi_asset_uid` resolves
        xform._cached_asset = SimpleNamespace(
            pk=1, latest_deployed_version_uid=VERSION_2
        )
        assert xform.deployed_version_uid == VERSION_2

    def test_prefers_the_row_over_the_asset(self):
        xform = XForm(json=xform_json(VERSION_1), kpi_asset_uid='aSomeAsset')
        xform._cached_asset = SimpleNamespace(
            pk=1, latest_deployed_version_uid=VERSION_2
        )
        assert xform.deployed_version_uid == VERSION_1


class TestAddFormVersions(TestCase):
    """
    Unit tests for the versions recorded on a single submission.
    """

    def test_no_op_when_the_submission_matches_the_deployed_version(self):
        xform = XForm(json=xform_json(VERSION_1))
        xml = submission_xml(version_uid=VERSION_1)
        # The XML must come back untouched, byte for byte
        assert add_form_versions(xml, xform) == xml

    def test_no_op_when_no_version_can_be_determined(self):
        xform = XForm(json=xform_json(None))
        xml = submission_xml(version_uid=VERSION_1)
        assert add_form_versions(xml, xform) == xml

    def test_removes_a_forged_history_when_no_version_can_be_determined(self):
        """
        A form we cannot place, one imported outside the deploy path or whose
        asset no longer resolves, is no reason to keep a history the client
        made up.
        """

        xform = XForm(json=xform_json(None))
        xml = submission_xml(
            version_uid=VERSION_1, form_versions=f'{VERSION_2} {VERSION_3}'
        )
        assert get_form_versions(add_form_versions(xml, xform)) is None

    def test_no_op_when_the_submission_declares_no_version(self):
        xform = XForm(json=xform_json(VERSION_2))
        xml = submission_xml(version_uid=None)
        assert add_form_versions(xml, xform) == xml

    def test_tags_both_versions_when_the_submission_is_stale(self):
        """
        A device collecting offline with an older version, sending once a newer
        one has been deployed.
        """

        xform = XForm(json=xform_json(VERSION_2))
        xml = add_form_versions(submission_xml(version_uid=VERSION_1), xform)
        assert get_form_versions(xml) == f'{VERSION_1} {VERSION_2}'

    def test_extends_an_existing_lineage_without_reordering_it(self):
        xform = XForm(json=xform_json(VERSION_3))
        xml = add_form_versions(
            submission_xml(version_uid=VERSION_1, deprecated_id='uuid:0'),
            xform,
            previous_xml=submission_xml(
                version_uid=VERSION_1,
                form_versions=f'{VERSION_1} {VERSION_2}',
            ),
        )
        assert get_form_versions(xml) == (f'{VERSION_1} {VERSION_2} {VERSION_3}')

    def test_no_op_when_the_versions_are_already_recorded(self):
        """
        An already tagged submission resubmitted without a redeployment in
        between must come back untouched, rather than be re-serialised with the
        very same value.
        """

        xform = XForm(json=xform_json(VERSION_2))
        xml = submission_xml(
            version_uid=VERSION_1,
            form_versions=f'{VERSION_1} {VERSION_2}',
            deprecated_id='uuid:0',
        )
        assert (
            add_form_versions(
                xml,
                xform,
                previous_xml=submission_xml(
                    version_uid=VERSION_1,
                    form_versions=f'{VERSION_1} {VERSION_2}',
                ),
            )
            == xml
        )

    def test_keeps_a_declared_version_missing_from_the_history(self):
        """
        Enketo recalculates `__version__` when the asset's own content carries
        such a row, so the declared version can be one the history does not
        know about yet. It must not be dropped.
        """

        xform = XForm(json=xform_json(VERSION_3))
        xml = add_form_versions(
            submission_xml(version_uid=VERSION_2, deprecated_id='uuid:0'),
            xform,
            previous_xml=submission_xml(version_uid=VERSION_1),
        )
        assert get_form_versions(xml) == (f'{VERSION_1} {VERSION_2} {VERSION_3}')

    def test_tagging_leaves_the_stripped_payload_untouched(self):
        """
        `xml_hash` is computed on the stripped XML on both sides, so tagging a
        submission must not change what stripping it yields. The node is written
        textually for that reason: re-serialising the tree would normalise the
        document and silently move the hash.
        """

        xform = XForm(json=xform_json(VERSION_3))
        for xml in (
            submission_xml(version_uid=VERSION_1),
            submission_xml(version_uid=VERSION_1, declaration=True),
            submission_xml(
                version_uid=VERSION_1,
                form_versions=f'{VERSION_1} {VERSION_2}',
                deprecated_id='uuid:0',
            ),
        ):
            xml_with_versions = add_form_versions(xml, xform)
            assert strip_form_versions(xml_with_versions) == strip_form_versions(xml)

    def test_strip_recovers_the_client_payload_byte_for_byte(self):
        """
        Clients never send the node themselves, so stripping a submission we
        tagged must give its exact original bytes back.
        """

        xform = XForm(json=xform_json(VERSION_2))
        for xml in (
            submission_xml(version_uid=VERSION_1),
            submission_xml(version_uid=VERSION_1, declaration=True),
        ):
            assert strip_form_versions(add_form_versions(xml, xform)) == xml

    def test_leaves_a_question_named_form_versions_alone(self):
        """
        `formVersions` is a legal question name. Only the node inside `<meta>`
        belongs to us, so the answer must survive tagging and stripping.
        """

        xform = XForm(json=xform_json(VERSION_2))
        xml = (
            f'<{ID_STRING} id="{ID_STRING}">'
            f'<{common_tags.FORM_VERSIONS}>an answer</{common_tags.FORM_VERSIONS}>'
            f'<{common_tags.VERSION}>{VERSION_1}</{common_tags.VERSION}>'
            '<meta><instanceID>uuid:1</instanceID></meta>'
            f'</{ID_STRING}>'
        )

        xml_with_versions = add_form_versions(xml, xform)

        assert f'<{common_tags.FORM_VERSIONS}>an answer' in xml_with_versions
        assert get_form_versions(xml_with_versions) == f'{VERSION_1} {VERSION_2}'
        assert strip_form_versions(xml_with_versions) == xml

    def test_replaces_the_meta_node_when_a_question_shares_its_name(self):
        xform = XForm(json=xform_json(VERSION_3))
        xml = (
            f'<{ID_STRING} id="{ID_STRING}">'
            f'<{common_tags.FORM_VERSIONS}>an answer</{common_tags.FORM_VERSIONS}>'
            f'<{common_tags.VERSION}>{VERSION_1}</{common_tags.VERSION}>'
            '<meta><instanceID>uuid:1</instanceID>'
            '<deprecatedID>uuid:0</deprecatedID>'
            f'<{common_tags.FORM_VERSIONS}>{VERSION_1} {VERSION_2}'
            f'</{common_tags.FORM_VERSIONS}></meta>'
            f'</{ID_STRING}>'
        )

        xml_with_versions = add_form_versions(
            xml,
            xform,
            previous_xml=submission_xml(
                version_uid=VERSION_1,
                form_versions=f'{VERSION_1} {VERSION_2}',
            ),
        )

        assert f'<{common_tags.FORM_VERSIONS}>an answer' in xml_with_versions
        assert get_form_versions(xml_with_versions) == (
            f'{VERSION_1} {VERSION_2} {VERSION_3}'
        )

    def test_no_op_on_a_namespaced_meta(self):
        """
        A client may send `<orx:meta>` rather than `<meta>`, which the textual
        writer does not anchor on. The submission must then come back untouched:
        no version history, but no corruption and a hash that stays consistent.

        Supporting the prefix is not worth it on its own, since the rest of KPI
        is equally prefix-blind: `bulk_update_submissions()` would create a
        second, unprefixed `<meta>` on the same document.
        """

        xform = XForm(json=xform_json(VERSION_2))
        xml = (
            f'<{ID_STRING} id="{ID_STRING}" xmlns:orx="http://openrosa.org/xforms">'
            f'<{common_tags.VERSION}>{VERSION_1}</{common_tags.VERSION}>'
            '<orx:meta><orx:instanceID>uuid:1</orx:instanceID></orx:meta>'
            f'</{ID_STRING}>'
        )

        assert add_form_versions(xml, xform) == xml
        assert strip_form_versions(xml) == xml

    def test_ignores_a_history_forged_by_the_client(self):
        """
        A new submission has no history of its own, so anything it carries under
        `meta/formVersions` was made up. Trusting it would let a client claim
        the deployed version and have its own declared one silently dropped.
        """

        xform = XForm(json=xform_json(VERSION_2))
        xml = submission_xml(version_uid=VERSION_1, form_versions=VERSION_2)

        assert get_form_versions(add_form_versions(xml, xform)) == (
            f'{VERSION_1} {VERSION_2}'
        )

    def test_discards_versions_carrying_markup(self):
        """
        `ElementTree` decodes entities, and the node is written back textually,
        so a value holding markup would leave the document malformed.
        """

        xform = XForm(json=xform_json(VERSION_2))
        xml = submission_xml(version_uid='A &amp; B')

        assert add_form_versions(xml, xform) == xml

    def test_edit_ignores_a_history_forged_by_the_client(self):
        """
        The record being edited is the only source of history. A client that
        claims the deployed version is the whole story must not be able to erase
        the versions the submission really went through.
        """

        xform = XForm(json=xform_json(VERSION_3))
        xml = add_form_versions(
            submission_xml(
                version_uid=VERSION_1,
                form_versions=VERSION_3,
                deprecated_id='uuid:0',
            ),
            xform,
            previous_xml=submission_xml(
                version_uid=VERSION_1,
                form_versions=f'{VERSION_1} {VERSION_2}',
            ),
        )
        assert get_form_versions(xml) == (f'{VERSION_1} {VERSION_2} {VERSION_3}')

    def test_removes_a_history_the_client_made_up(self):
        """
        A new submission has none, so anything it carries is discarded rather
        than left in place.
        """

        xform = XForm(json=xform_json(VERSION_1))
        xml = add_form_versions(
            submission_xml(
                version_uid=VERSION_1, form_versions=f'{VERSION_2} {VERSION_3}'
            ),
            xform,
        )
        assert get_form_versions(xml) is None

    def test_replaces_a_node_the_client_misplaced_in_meta(self):
        """
        Our node is written as the last child of `<meta>`, but a client is free
        to put its own anywhere in there. Scoping to the `<meta>` block rather
        than to the closing tag is what replaces it instead of appending a
        second one and leaving the forged value to be read back first.
        """

        xform = XForm(json=xform_json(VERSION_2))
        xml = (
            f'<{ID_STRING} id="{ID_STRING}">'
            f'<{common_tags.VERSION}>{VERSION_1}</{common_tags.VERSION}>'
            '<meta>'
            f'<{common_tags.FORM_VERSIONS}>{VERSION_3}'
            f'</{common_tags.FORM_VERSIONS}>'
            '<instanceID>uuid:1</instanceID>'
            '<rootUuid>uuid:0</rootUuid>'
            '</meta>'
            f'</{ID_STRING}>'
        )

        xml_with_versions = add_form_versions(xml, xform)

        assert xml_with_versions.count(f'<{common_tags.FORM_VERSIONS}>') == 1
        assert get_form_versions(xml_with_versions) == f'{VERSION_1} {VERSION_2}'
        assert '<rootUuid>uuid:0</rootUuid>' in xml_with_versions

    def test_replaces_a_node_whatever_shape_the_client_gave_it(self):
        """
        `ElementTree` reads an element by name, ignoring attributes and
        spacing, and `find()` returns the first one. A node we failed to remove
        would therefore be read back ahead of ours on the next edit.
        """

        xform = XForm(json=xform_json(VERSION_2))
        for node in (
            f'<{common_tags.FORM_VERSIONS} source="client">{VERSION_3}'
            f'</{common_tags.FORM_VERSIONS}>',
            f'<{common_tags.FORM_VERSIONS} >{VERSION_3}'
            f'</{common_tags.FORM_VERSIONS}>',
            f'<{common_tags.FORM_VERSIONS}>{VERSION_3}'
            f'</{common_tags.FORM_VERSIONS} >',
            f'<{common_tags.FORM_VERSIONS} />',
            f'<{common_tags.FORM_VERSIONS} source="x"/>',
        ):
            xml = (
                f'<{ID_STRING} id="{ID_STRING}">'
                f'<{common_tags.VERSION}>{VERSION_1}</{common_tags.VERSION}>'
                f'<meta>{node}<instanceID>uuid:1</instanceID></meta>'
                f'</{ID_STRING}>'
            )

            xml_with_versions = add_form_versions(xml, xform)

            assert xml_with_versions.count(f'<{common_tags.FORM_VERSIONS}') == 1, node
            assert get_form_versions(xml_with_versions) == (
                f'{VERSION_1} {VERSION_2}'
            ), node

    def test_leaves_the_document_alone_on_a_shape_it_cannot_remove(self):
        """
        A node wrapping other elements cannot be removed textually without
        risking a dangling tag. Nothing is written in that case, rather than
        appending a second node beside it. It is never read as history anyway,
        since only uid-shaped values are kept.
        """

        xform = XForm(json=xform_json(VERSION_2))
        xml = (
            f'<{ID_STRING} id="{ID_STRING}">'
            f'<{common_tags.VERSION}>{VERSION_1}</{common_tags.VERSION}>'
            '<meta>'
            f'<{common_tags.FORM_VERSIONS}><a>x</a>'
            f'</{common_tags.FORM_VERSIONS}>'
            '<instanceID>uuid:1</instanceID>'
            '</meta>'
            f'</{ID_STRING}>'
        )

        assert add_form_versions(xml, xform) == xml

    def test_ignores_a_meta_written_inside_a_comment_or_cdata(self):
        """
        A submission may carry `<meta>` as text. The first textual match would
        then land inside it, writing the node where no parser reads it back and
        leaving the real metadata untouched.
        """

        xform = XForm(json=xform_json(VERSION_2))
        for decoy in (
            '<!-- <meta><x/></meta> -->',
            '<note><![CDATA[<meta><x/></meta>]]></note>',
        ):
            xml = (
                f'<{ID_STRING} id="{ID_STRING}">'
                f'<{common_tags.VERSION}>{VERSION_1}</{common_tags.VERSION}>'
                f'{decoy}'
                '<meta><instanceID>uuid:1</instanceID></meta>'
                f'</{ID_STRING}>'
            )

            xml_with_versions = add_form_versions(xml, xform)

            # Read through the parser, which ignores comments and CDATA
            assert get_form_versions(xml_with_versions) == (
                f'{VERSION_1} {VERSION_2}'
            ), decoy
            assert decoy in xml_with_versions, decoy
            assert strip_form_versions(xml_with_versions) == xml, decoy

    def test_ignores_a_meta_nested_below_the_document_element(self):
        """
        A group may itself be named `meta`. Writing into a nested one would
        leave the history where nothing reads it, since the parser only looks at
        direct children of the document element.
        """

        xform = XForm(json=xform_json(VERSION_2))
        decoy = '<group><meta><x/></meta></group>'
        real = '<meta><instanceID>uuid:1</instanceID></meta>'

        for body in (f'{decoy}{real}', f'{real}{decoy}'):
            xml = (
                f'<{ID_STRING} id="{ID_STRING}">'
                f'<{common_tags.VERSION}>{VERSION_1}</{common_tags.VERSION}>'
                f'{body}'
                f'</{ID_STRING}>'
            )

            xml_with_versions = add_form_versions(xml, xform)

            assert get_form_versions(xml_with_versions) == (
                f'{VERSION_1} {VERSION_2}'
            ), body
            assert decoy in xml_with_versions, body
            assert strip_form_versions(xml_with_versions) == xml, body

    def test_is_idempotent(self):
        xform = XForm(json=xform_json(VERSION_2))
        once = add_form_versions(submission_xml(version_uid=VERSION_1), xform)
        assert add_form_versions(once, xform) == once

    def test_leaves_the_declared_version_untouched(self):
        xform = XForm(json=xform_json(VERSION_2))
        xml = add_form_versions(submission_xml(version_uid=VERSION_1), xform)
        assert fromstring_preserve_root_xmlns(xml).find(VERSION).text == VERSION_1

    def test_keeps_the_xml_declaration_when_the_client_sent_one(self):
        xform = XForm(json=xform_json(VERSION_2))
        xml = add_form_versions(
            submission_xml(version_uid=VERSION_1, declaration=True), xform
        )
        assert xml.startswith('<?xml')

    def test_adds_no_declaration_when_the_client_sent_none(self):
        xform = XForm(json=xform_json(VERSION_2))
        xml = add_form_versions(
            submission_xml(version_uid=VERSION_1, declaration=False), xform
        )
        assert not xml.startswith('<?xml')


class TestFormVersionsOnSubmission(TestCase):
    """
    End to end tests through `create_instance()`, the single choke point every
    submission and every edit goes through.
    """

    def setUp(self):
        self.user = User.objects.create(username='bob')
        UserProfile.objects.get_or_create(user=self.user)
        self.xform = XForm.objects.create(
            xml=xform_xml(),
            user=self.user,
            json=xform_json(VERSION_1),
            uuid=FORM_UUID,
            require_auth=False,
        )

        class FakeRequest:
            pass

        self.request = FakeRequest()
        self.request.user = self.user
        self.request.user.has_perm = lambda *args, **kwargs: True

    def test_matching_version_records_nothing(self):
        instance = self._submit(submission_xml(version_uid=VERSION_1))
        assert get_form_versions(instance.xml) is None
        assert META_FORM_VERSIONS not in instance.json

    def test_stale_offline_submission_records_both_versions(self):
        self._deploy(VERSION_2)
        instance = self._submit(submission_xml(version_uid=VERSION_1))
        assert get_form_versions(instance.xml) == f'{VERSION_1} {VERSION_2}'
        # The node is a plain leaf, so it reaches the JSON representation, and
        # therefore Mongo, without any extra plumbing
        assert instance.json[META_FORM_VERSIONS] == f'{VERSION_1} {VERSION_2}'

    def test_edit_with_a_newer_version_records_both_versions(self):
        instance = self._submit(submission_xml(version_uid=VERSION_1))
        self._deploy(VERSION_2)
        edited = self._submit(self._edit_xml(instance))
        assert edited.pk == instance.pk
        assert get_form_versions(edited.xml) == f'{VERSION_1} {VERSION_2}'

    def test_edit_keeps_the_history_even_if_the_client_strips_it(self):
        """
        The history comes from the record being edited, not from the incoming
        XML, so a client posting an edit stripped of both `__version__` and
        `meta/formVersions` cannot make the versions disappear.
        """

        instance = self._submit(submission_xml(version_uid=VERSION_1))
        self._deploy(VERSION_2)
        edited = self._submit(self._edit_xml(instance, strip_versions=True))
        assert get_form_versions(edited.xml) == f'{VERSION_1} {VERSION_2}'

    def test_successive_edits_accumulate_versions(self):
        instance = self._submit(submission_xml(version_uid=VERSION_1))
        self._deploy(VERSION_2)
        self._submit(self._edit_xml(instance))
        instance.refresh_from_db()
        self._deploy(VERSION_3)
        edited = self._submit(self._edit_xml(instance))
        assert get_form_versions(edited.xml) == (f'{VERSION_1} {VERSION_2} {VERSION_3}')

    def test_retried_edit_rebuilds_the_same_xml(self):
        """
        The versions are written before `xml_hash` is computed, so a retry that
        rebuilt them differently would no longer be recognised as a duplicate.
        `add_form_versions()` is a pure function of the XML and the form, which
        is what keeps the result stable.
        """

        instance = self._submit(submission_xml(version_uid=VERSION_1))
        self._deploy(VERSION_2)
        edit_xml = self._edit_xml(instance)
        edited = self._submit(edit_xml)

        assert InstanceHistory.objects.filter(xform_instance=edited).count() == 1

        # Same payload again: the deprecated id no longer resolves to an
        # `Instance`, only to an `InstanceHistory` row. Reaching the duplicate
        # branch proves the rebuilt XML hashed identically; without the
        # fallback the edit would be replayed and raise `DeprecatedIdGoneError`
        with self.assertRaises(DuplicateInstanceError):
            self._submit(edit_xml)

        assert InstanceHistory.objects.filter(xform_instance=edited).count() == 1

    def test_recomputing_the_hash_from_the_stored_xml_matches_the_client(self):
        """
        Maintenance paths recompute `xml_hash` straight from `instance.xml`
        (`clean_duplicated_submissions`, `fix_root_node_names`,
        `populate_xml_hashes_for_instances`, ...). They must land on the value
        duplicate detection compares, otherwise a later retry or a split upload
        no longer finds the record.
        """

        self._deploy(VERSION_2)
        xml = submission_xml(version_uid=VERSION_1)
        instance = self._submit(xml)
        assert get_form_versions(instance.xml) is not None

        assert instance.xml_hash == Instance.get_hash(xml)
        # What a maintenance command does, with no knowledge of the node
        assert Instance.get_hash(instance.xml) == Instance.get_hash(xml)

    def test_split_submission_still_attaches_after_a_redeploy(self):
        """
        Enketo splits a submission whose media exceed its upload limit into
        several POSTs carrying the same XML, and the server matches the later
        ones to the existing record by `xml_hash`. That hash must therefore not
        depend on the version deployed at the time: a redeployment between two
        POSTs would otherwise orphan the remaining files.
        """

        self._deploy(VERSION_2)
        xml = submission_xml(version_uid=VERSION_1)
        instance = self._submit(xml)
        assert get_form_versions(instance.xml) == f'{VERSION_1} {VERSION_2}'

        self._deploy(VERSION_3)
        same_instance = self._submit(
            xml,
            media_files=[
                SimpleUploadedFile('photo.jpg', b'jpeg', content_type='image/jpeg')
            ],
        )

        assert same_instance.pk == instance.pk
        assert same_instance.attachments.count() == 1
        # The later POST attaches files, it never rewrites the stored XML
        same_instance.refresh_from_db()
        assert get_form_versions(same_instance.xml) == f'{VERSION_1} {VERSION_2}'

    def test_resubmission_after_a_redeploy_is_still_a_duplicate(self):
        self._deploy(VERSION_2)
        xml = submission_xml(version_uid=VERSION_1)
        self._submit(xml)

        self._deploy(VERSION_3)
        with self.assertRaises(DuplicateInstanceError):
            self._submit(xml)

    def test_retried_edit_after_a_redeploy_is_still_a_duplicate(self):
        instance = self._submit(submission_xml(version_uid=VERSION_1))
        self._deploy(VERSION_2)
        edit_xml = self._edit_xml(instance)
        self._submit(edit_xml)

        self._deploy(VERSION_3)
        with self.assertRaises(DuplicateInstanceError):
            self._submit(edit_xml)

    def _deploy(self, version_uid: str):
        """
        Simulate a redeployment of the form at `version_uid`.
        """

        XForm.objects.filter(pk=self.xform.pk).update(json=xform_json(version_uid))

    def _edit_xml(self, instance: Instance, strip_versions: bool = False) -> str:
        """
        Build the XML an editor posts back for `instance`.

        Both real paths start from the stored XML: a bulk edit round-trips it,
        and Enketo merges it into its model. `strip_versions` reproduces a
        hypothetical client that drops the version nodes instead.
        """

        xml_parsed = fromstring_preserve_root_xmlns(instance.xml)
        if strip_versions:
            for path in (VERSION, META_FORM_VERSIONS):
                if (element := xml_parsed.find(path)) is not None:
                    parent = (
                        xml_parsed
                        if '/' not in path
                        else xml_parsed.find(path.rsplit('/', 1)[0])
                    )
                    parent.remove(element)
        edit_submission_xml(xml_parsed, 'q1', 'edited')
        edit_submission_xml(xml_parsed, 'meta/deprecatedID', f'uuid:{instance.uuid}')
        edit_submission_xml(
            xml_parsed, 'meta/instanceID', f'uuid:{uuid_module.uuid4()}'
        )
        edit_submission_xml(xml_parsed, 'meta/rootUuid', f'uuid:{instance.root_uuid}')
        return xml_tostring(xml_parsed)

    def _submit(self, xml: str, media_files: list = None) -> Instance:
        return create_instance(
            self.user.username,
            io.BytesIO(xml.encode()),
            media_files=media_files or [],
            request=self.request,
            check_usage_limits=False,
        )
