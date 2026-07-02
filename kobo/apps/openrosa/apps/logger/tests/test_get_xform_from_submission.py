from django.http import Http404
from django.test import TestCase

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import XForm
from kobo.apps.openrosa.libs.utils.logger_tools import (
    _exclude_common_paths,
    _get_submission_field_paths,
    _get_xform_template_field_paths,
    get_xform_from_submission,
)

# Both forms deliberately share the same `id_string` (`shared_id`) but belong to
# different owners and expose different schemas, reproducing the cross-owner
# `id_string` collision that the disambiguation logic must resolve.
SHARED_ID = 'shared_id'


def _xform_xml(title: str, instance_body: str) -> str:
    return (
        '<?xml version="1.0" encoding="utf-8"?>'
        '<h:html xmlns="http://www.w3.org/2002/xforms"'
        ' xmlns:h="http://www.w3.org/1999/xhtml"'
        ' xmlns:jr="http://openrosa.org/javarosa">'
        '<h:head>'
        f'<h:title>{title}</h:title>'
        '<model>'
        '<instance>'
        f'<{SHARED_ID} id="{SHARED_ID}" version="1">'
        '<formhub><uuid/></formhub>'
        f'{instance_body}'
        '<__version__/>'
        '<meta><instanceID/></meta>'
        f'</{SHARED_ID}>'
        '</instance>'
        f'<bind nodeset="/{SHARED_ID}/meta/instanceID" type="string"/>'
        '</model>'
        '</h:head>'
        '<h:body/>'
        '</h:html>'
    )


def _submission_xml(instance_body: str) -> str:
    return (
        f'<{SHARED_ID} id="{SHARED_ID}" version="1">'
        '<formhub><uuid>7117fdf814234f5ea0c9f5801b022293</uuid></formhub>'
        f'{instance_body}'
        '<__version__>v1</__version__>'
        '<meta><instanceID>uuid:55d873b2-3a25-4370-8cd9-c41ed4156d07'
        '</instanceID></meta>'
        f'</{SHARED_ID}>'
    )


# Flat schema: top-level fields only.
FORM_A_XML = _xform_xml('Form A', '<name/><note1/><note2/>')
SUBMISSION_A_XML = _submission_xml('<name>Bob</name><note1/><note2/>')

# Grouped schema: nested groups + ODK preload fields.
FORM_B_XML = _xform_xml(
    'Form B',
    '<start/><end/><today/><deviceid/>'
    '<demographic><name/><nationality/></demographic>'
    '<weather><temp/></weather>'
    '<observation><bird/></observation>',
)
SUBMISSION_B_XML = _submission_xml(
    '<start>t</start><end>t</end><today>d</today><deviceid>x</deviceid>'
    '<demographic><name>Bob</name></demographic>'
    '<weather><temp>20</temp></weather>'
    '<observation><bird>eagle</bird></observation>'
)


class TestFieldPathHelpers(TestCase):
    """
    Unit tests for the schema-fingerprinting helpers (no database access).
    """

    def test_submission_paths_strip_common_metadata(self):
        # `formhub`, `meta`, `__version__` are dropped: only real questions remain
        assert _get_submission_field_paths(SUBMISSION_A_XML) == {
            'name',
            'note1',
            'note2',
        }

    def test_submission_paths_use_full_xpaths_for_nested_groups(self):
        # Nested groups are compared by full path, not by bare tag name, and the
        # `jr:preload` fields (start/end/today/deviceid) are treated as common.
        assert _get_submission_field_paths(SUBMISSION_B_XML) == {
            'demographic',
            'demographic/name',
            'weather',
            'weather/temp',
            'observation',
            'observation/bird',
        }

    def test_template_paths_match_submission_paths(self):
        # A form template exposes every field, empty or not, so the submission's
        # paths must be a subset of the template's.
        template_a = _get_xform_template_field_paths(FORM_A_XML)
        assert template_a == {'name', 'note1', 'note2'}
        assert _get_submission_field_paths(SUBMISSION_A_XML) <= template_a

        template_b = _get_xform_template_field_paths(FORM_B_XML)
        assert 'demographic/nationality' in template_b
        assert _get_submission_field_paths(SUBMISSION_B_XML) <= template_b

    def test_preload_fields_excluded_from_template(self):
        template_b = _get_xform_template_field_paths(FORM_B_XML)
        assert {'start', 'end', 'today', 'deviceid'}.isdisjoint(template_b)

    def test_exclude_common_paths_drops_metadata_and_descendants(self):
        paths = {
            'formhub',
            'formhub/uuid',
            'meta',
            'meta/instanceID',
            '__version__',
            'start',
            'name',
            'demographic/name',
        }
        assert _exclude_common_paths(paths) == {'name', 'demographic/name'}


class TestGetXFormFromSubmissionCollision(TestCase):
    """
    Integration tests for `id_string` collisions across different owners.
    """

    def setUp(self):
        self.alice = User.objects.create(username='alice')
        self.bob = User.objects.create(username='bob')
        # `uuid` is left blank so the UUID lookup misses and the code falls back
        # to `id_string` resolution, which then hits `MultipleObjectsReturned`.
        self.xform_a = XForm.objects.create(
            xml=FORM_A_XML, user=self.alice, require_auth=False
        )
        self.xform_b = XForm.objects.create(
            xml=FORM_B_XML, user=self.bob, require_auth=False
        )
        assert self.xform_a.id_string == SHARED_ID
        assert self.xform_b.id_string == SHARED_ID

    def test_routes_submission_to_form_matching_its_schema(self):
        resolved = get_xform_from_submission(SUBMISSION_A_XML, self.alice.username)
        assert resolved.pk == self.xform_a.pk

        resolved = get_xform_from_submission(SUBMISSION_B_XML, self.bob.username)
        assert resolved.pk == self.xform_b.pk

    def test_ownership_does_not_influence_routing(self):
        # Even when the submitter owns the *other* colliding form, routing is
        # decided purely by schema conformance.
        resolved = get_xform_from_submission(SUBMISSION_B_XML, self.alice.username)
        assert resolved.pk == self.xform_b.pk

    def test_ambiguous_submission_fails_closed(self):
        # A submission with no distinguishing fields (only common metadata) is a
        # subset of every candidate template. When the submitter owns none of the
        # colliding forms, there is no way to disambiguate -> refuse.
        carol = User.objects.create(username='carol')
        empty_submission = _submission_xml('')
        with self.assertRaises(Http404):
            get_xform_from_submission(empty_submission, carol.username)

    def test_identical_schema_disambiguated_by_ownership(self):
        # Two forms sharing the same `id_string` AND the same schema (e.g. the
        # same form published by two accounts) cannot be told apart by content;
        # ownership breaks the tie so a submitter reaches their own form.
        carol = User.objects.create(username='carol')
        xform_a_clone = XForm.objects.create(
            xml=FORM_A_XML, user=carol, require_auth=False
        )

        resolved = get_xform_from_submission(SUBMISSION_A_XML, carol.username)
        assert resolved.pk == xform_a_clone.pk

        resolved = get_xform_from_submission(SUBMISSION_A_XML, self.alice.username)
        assert resolved.pk == self.xform_a.pk

    def test_submission_matching_no_form_raises_404(self):
        unknown_submission = _submission_xml(
            '<totally_unknown_field>x</totally_unknown_field>'
        )
        with self.assertRaises(Http404):
            get_xform_from_submission(unknown_submission, self.alice.username)
