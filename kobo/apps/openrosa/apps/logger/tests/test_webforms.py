# coding: utf-8
import os

from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from kobo.apps.openrosa.apps.logger.models.instance import Instance
from kobo.apps.openrosa.apps.logger.xform_instance_parser import get_uuid_from_xml
from kobo.apps.openrosa.libs.utils.logger_tools import inject_instanceid


class TestWebforms(TestBase):
    def setUp(self):
        super().setUp()
        self._publish_transportation_form_and_submit_instance()

    def __load_fixture(self, *path):
        with open(os.path.join(os.path.dirname(__file__), *path), 'r') as f:
            return f.read()

    def test_inject_instanceid(self):
        """
        Test that 1 and only 1 instance id exists or is injected
        """
        instance = Instance.objects.all().reverse()[0]
        xml_str = self.__load_fixture("..", "fixtures", "tutorial",
                                      "instances",
                                      "tutorial_2012-06-27_11-27-53.xml")
        # test that we dont have an instance id
        uuid = get_uuid_from_xml(xml_str)
        self.assertIsNone(uuid)
        injected_xml_str = inject_instanceid(xml_str, instance.uuid)
        # check that xml has the instanceid tag
        uuid = get_uuid_from_xml(injected_xml_str)
        self.assertEqual(uuid, instance.uuid)

    def test_dont_inject_instanceid_if_exists(self):
        xls_file_path = os.path.join(
            os.path.dirname(__file__),
            '..',
            'fixtures',
            'tutorial',
            'tutorial.xls')
        self._publish_xls_file_and_set_xform(xls_file_path)
        xml_file_path = os.path.join(
            os.path.dirname(__file__),
            '..',
            'fixtures',
            'tutorial',
            'instances',
            'tutorial_2012-06-27_11-27-53_w_uuid.xml')
        self._make_submission(xml_file_path)
        instance = Instance.objects.order_by('id').reverse()[0]
        injected_xml_str = inject_instanceid(instance.xml, instance.uuid)
        # check that the xml is unmodified
        self.assertEqual(instance.xml, injected_xml_str)
