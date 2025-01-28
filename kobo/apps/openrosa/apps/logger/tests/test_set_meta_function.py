from django.test import TestCase
from kobo.apps.openrosa.apps.logger.xform_instance_parser import set_meta


class TestSetMetaFunction(TestCase):
    def test_set_meta_updates_xml_correctly(self):
        """
        Test that the set_meta() does not add an XML declaration
        """
        xml_input = """
        <data>
            <meta>
                <instanceID>uuid:original-id</instanceID>
            </meta>
            <question1>Answer1</question1>
        </data>
        """
        updated_xml = set_meta(
            xml_input, 'instanceID', 'uuid:new-id'
        )

        # Ensure XML declaration is not added
        self.assertNotIn("<?xml version='1.0' ?>", updated_xml)

        # Ensure the instanceID is updated
        self.assertIn('<instanceID>uuid:new-id</instanceID>', updated_xml)

    def test_set_meta_raises_error_for_missing_node(self):
        xml_input = """
        <data>
            <meta>
                <otherID>uuid:other-id</otherID>
            </meta>
            <question1>Answer1</question1>
        </data>
        """
        with self.assertRaises(ValueError) as context:
            set_meta(xml_input, 'instanceID', 'uuid:new-id')

        self.assertEqual(str(context.exception), 'instanceID node not found')
