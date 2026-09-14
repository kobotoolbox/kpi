# coding: utf-8
import os
import re

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import XForm
from kobo.apps.openrosa.apps.logger.xform_instance_parser import (
    XFormInstanceParser,
    _xml_node_to_dict,
    clean_and_parse_xml,
    get_deprecated_uuid_from_xml,
    get_meta_from_xml,
    get_uuid_from_xml,
    get_xform_media_question_xpaths,
    xpath_from_xml_node,
)
from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from kobo.apps.openrosa.libs.utils.common_tags import XFORM_ID_STRING
from kpi.utils.xml import minidom_parsestring

XML = 'xml'
DICT = 'dict'
FLAT_DICT = 'flat_dict'
ID = XFORM_ID_STRING


class TestXFormInstanceParser(TestBase):
    def _publish_and_submit_new_repeats(self):
        self._create_user_and_login()
        # publish our form which contains some some repeats
        xls_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            '../fixtures/new_repeats/new_repeats.xls',
        )
        self._publish_xls_file_and_set_xform(xls_file_path)

        # submit an instance
        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            '../fixtures/new_repeats/instances/' 'new_repeats_2012-07-05-14-33-53.xml',
        )
        self._make_submission(xml_submission_file_path)

        # load xml file to parse and compare
        xml_file = open(xml_submission_file_path)
        self.xml = xml_file.read()
        xml_file.close()

    def test_parse_xform_nested_repeats(self):
        self._publish_and_submit_new_repeats()
        parser = XFormInstanceParser(self.xml, self.xform.data_dictionary())
        dict_ = parser.to_dict()
        expected_dict = {
            'new_repeats': {
                'info':
                {
                    'age': '80',
                    'name': 'Adam'
                },
                'kids':
                {
                    'kids_details':
                    [
                        {
                            'kids_age': '50',
                            'kids_name': 'Abel'
                        },
                    ],
                    'has_kids': '1'
                },
                'web_browsers': 'chrome ie',
                'gps': '-1.2627557 36.7926442 0.0 30.0',
                'meta': {
                    'instanceID': 'uuid:364f173c688e482486a48661700466gg'
                }
            }
        }
        self.assertEqual(dict_, expected_dict)

        flat_dict = parser.to_flat_dict()
        expected_flat_dict = {
            'gps': '-1.2627557 36.7926442 0.0 30.0',
            'kids/kids_details':
            [
                {
                    'kids/kids_details/kids_name': 'Abel',
                    'kids/kids_details/kids_age': '50'
                }
            ],
            'kids/has_kids': '1',
            'info/age': '80',
            'web_browsers': 'chrome ie',
            'info/name': 'Adam',
            'meta/instanceID': 'uuid:364f173c688e482486a48661700466gg'
        }
        self.assertEqual(flat_dict, expected_flat_dict)

    def test_xpath_from_xml_node(self):
        xml_str = (
            "<?xml version='1.0' ?><test_item_name_matches_repeat "
            'id="repeat_child_name_matches_repeat">'
            '<formhub><uuid>c911d71ce1ac48478e5f8bac99addc4e</uuid>'
            '</formhub><gps><gps>-1.2625149 36.7924478 0.0 30.0</gps>'
            '<info>Yo</info></gps><gps>'
            '<gps>-1.2625072 36.7924328 0.0 30.0</gps>'
            '<info>What</info></gps></test_item_name_matches_repeat>'
        )
        clean_xml_str = xml_str.strip()
        clean_xml_str = re.sub(r'>\s+<', '><', clean_xml_str)
        root_node = minidom_parsestring(clean_xml_str).documentElement
        # get the first top-level gps element
        gps_node = root_node.firstChild.nextSibling
        self.assertEqual(gps_node.nodeName, 'gps')
        # get the info element within the gps element
        info_node = gps_node.getElementsByTagName('info')[0]
        # create an xpath that should look like gps/info
        xpath = xpath_from_xml_node(info_node)
        self.assertEqual(xpath, 'gps/info')

    def test_get_meta_from_xml(self):
        with open(
            os.path.join(
                os.path.dirname(__file__),
                '..',
                'fixtures',
                'tutorial',
                'instances',
                'tutorial_2012-06-27_11-27-53_w_uuid_edited.xml',
            ),
            'r',
        ) as xml_file:
            xml_str = xml_file.read()
        instanceID = get_meta_from_xml(xml_str, 'instanceID')
        self.assertEqual(instanceID, 'uuid:2d8c59eb-94e9-485d-a679-b28ffe2e9b98')
        deprecatedID = get_meta_from_xml(xml_str, 'deprecatedID')
        self.assertEqual(deprecatedID, 'uuid:729f173c688e482486a48661700455ff')

    def test_get_meta_from_xml_without_uuid_returns_none(self):
        with open(
            os.path.join(
                os.path.dirname(__file__),
                '..',
                'fixtures',
                'tutorial',
                'instances',
                'tutorial_2012-06-27_11-27-53.xml',
            ),
            'r',
        ) as xml_file:
            xml_str = xml_file.read()
        instanceID = get_meta_from_xml(xml_str, 'instanceID')
        self.assertIsNone(instanceID)

    def test_get_uuid_from_xml(self):
        with open(
            os.path.join(
                os.path.dirname(__file__),
                '..',
                'fixtures',
                'tutorial',
                'instances',
                'tutorial_2012-06-27_11-27-53_w_uuid.xml',
            ),
            'r',
        ) as xml_file:
            xml_str = xml_file.read()
        instanceID = get_uuid_from_xml(xml_str)
        self.assertEqual(instanceID, '729f173c688e482486a48661700455ff')

        # Additional test case for a custom prefixed UUID
        submission = """<?xml version="1.0" encoding="UTF-8" ?>
        <submission xmlns:orx="http://openrosa.org/xforms">
            <meta><instanceID>uuid:kobotoolbox.org:123456789</instanceID></meta>
        </submission>
        """
        custom_instance_id = get_uuid_from_xml(submission)
        self.assertEqual(custom_instance_id, 'kobotoolbox.org:123456789')

    def test_get_deprecated_uuid_from_xml(self):
        with open(
            os.path.join(
                os.path.dirname(__file__),
                '..',
                'fixtures',
                'tutorial',
                'instances',
                'tutorial_2012-06-27_11-27-53_w_uuid_edited.xml',
            ),
            'r',
        ) as xml_file:
            xml_str = xml_file.read()
        deprecatedID = get_deprecated_uuid_from_xml(xml_str)
        self.assertEqual(deprecatedID, '729f173c688e482486a48661700455ff')

    def test_parse_xform_nested_repeats_multiple_nodes(self):
        self._create_user_and_login()
        # publish our form which contains some some repeats
        xls_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            '../fixtures/new_repeats/new_repeats.xls',
        )
        self._publish_xls_file_and_set_xform(xls_file_path)

        # submit an instance
        xml_submission_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            '../fixtures/new_repeats/instances/' 'multiple_nodes_error.xml',
        )
        self._make_submission(xml_submission_file_path)

    def test_xml_repeated_group_to_dict(self):
        xml_file = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            '../fixtures/repeated_group/repeated_group.xml',
        )
        json_file = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            '../fixtures/repeated_group/repeated_group.json',
        )
        with open(xml_file) as file:
            dict_ = _xml_node_to_dict(clean_and_parse_xml(file.read()))
            self.assertTrue(dict_['#document']['form']['question_group'])
            self.assertEqual(2, len(dict_['#document']['form']['question_group']))
            with open(json_file) as jfile:
                import json
                jfile_content = jfile.read()
                self.assertEqual(jfile_content.strip(), json.dumps(dict_).strip())

    def test_get_xform_media_question_xpaths(self):
        xml_refs = [
            'project_with_ref_after.xml',
            'project_with_ref_before.xml',
        ]
        bob = User.objects.get(username='bob')
        for xml_ref in xml_refs:
            xml_path = self._fixture_path('signature', xml_ref)
            with open(xml_path) as f:
                xml_str = f.read()
            id_string, _ = os.path.splitext(xml_ref)
            xf = XForm.objects.create(xml=xml_str, user=bob, id_string=id_string)
            expected = [
                f'{id_string}/image',
                f'{id_string}/signature',
            ]
            assert sorted(expected) == sorted(get_xform_media_question_xpaths(xf))

    def test_get_xform_media_question_xpaths_ignores_a_node_without_ref(self):
        bob = User.objects.get(username='bob')
        xml_path = self._fixture_path('signature', 'project_with_ref_before.xml')
        with open(xml_path) as f:
            xml_str = f.read()

        # A `mediatype` pointing at nothing used to raise a `KeyError`, which
        # failed the submission being saved
        xml_str = xml_str.replace(
            '<upload ref="/project_with_ref_before/image" mediatype="image/*">',
            '<upload mediatype="image/*">',
        )
        xform = XForm.objects.create(
            xml=xml_str, user=bob, id_string='project_with_ref_before'
        )

        with self.assertLogs('console_logger', level='WARNING') as logs:
            assert get_xform_media_question_xpaths(xform) == [
                'project_with_ref_before/signature'
            ]

        assert 'media node with no usable `ref`' in logs.output[0]

    def test_get_xform_media_question_xpaths_keeps_accents_of_a_latin1_form(self):
        bob = User.objects.get(username='bob')
        xml_path = self._fixture_path('signature', 'project_with_ref_before.xml')
        with open(xml_path) as f:
            xml_str = f.read()

        # A form is held as text, so its declaration only says what it was
        # encoded with on the way in. Handing those characters to a parser as
        # UTF-8 bytes would have expat decode them as declared instead, and
        # `signature_é` would come back as `signature_Ã©`
        xml_str = xml_str.replace(
            '<?xml version="1.0" encoding="utf-8"?>',
            '<?xml version="1.0" encoding="ISO-8859-1"?>',
        ).replace('/signature', '/signature_é')
        xform = XForm.objects.create(
            xml=xml_str, user=bob, id_string='project_with_ref_before'
        )

        assert sorted(get_xform_media_question_xpaths(xform)) == [
            'project_with_ref_before/image',
            'project_with_ref_before/signature_é',
        ]
