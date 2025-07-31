import os
import shutil
import tempfile
from unittest import mock

from django.test import TestCase
from django.contrib.auth import get_user_model

from kobo.apps.openrosa.apps.logger.import_tools import import_instances_from_path
from kobo.apps.openrosa.apps.logger.models import Instance

User = get_user_model()


class TestImportTools(TestCase):

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.user = User.objects.create_user('test', 'test@test.com', 'test')
        self.instance_dir = os.path.join(self.temp_dir, 'instance_dir')
        os.makedirs(self.instance_dir)

    def tearDown(self):
        shutil.rmtree(self.temp_dir)

    @mock.patch('kobo.apps.openrosa.apps.logger.import_tools.create_instance')
    def test_import_instances_from_path(self, mock_create_instance):
        """
        Test that `import_instances_from_path` can import a submission with
        multiple attachment types.
        """
        # Create a dummy XML file
        xml_path = os.path.join(self.instance_dir, 'submission.xml')
        with open(xml_path, 'w') as f:
            f.write('<data id="test"><meta><instanceID>1</instanceID></meta></data>')

        # Create dummy attachments
        attachments = {
            'photo.jpg': 'image/jpeg',
            'doc.pdf': 'application/pdf',
            'sound.mp4': 'video/mp4',
        }
        for filename in attachments:
            with open(os.path.join(self.instance_dir, filename), 'w') as f:
                f.write('dummy content')

        # Mock `create_instance` to avoid database operations
        mock_instance = mock.MagicMock(spec=Instance)
        mock_create_instance.return_value = mock_instance

        # Run the import
        total, success, errors = import_instances_from_path(self.temp_dir, self.user)

        # Check results
        self.assertEqual(total, 1)
        self.assertEqual(success, 1)
        self.assertEqual(errors, [])

        # Check that `create_instance` was called with the correct arguments
        mock_create_instance.assert_called_once()
        args, _ = mock_create_instance.call_args
        username, xml_file, media_files, status = args

        self.assertEqual(username, self.user.username)
        self.assertEqual(xml_file.name, xml_path)
        self.assertEqual(status, 'zip')

        # Check that all attachments were processed with the correct content type
        self.assertEqual(len(media_files), len(attachments))
        media_filenames = sorted([os.path.basename(f.name) for f in media_files])
        self.assertEqual(media_filenames, sorted(attachments.keys()))

        for media_file in media_files:
            filename = os.path.basename(media_file.name)
            self.assertEqual(media_file.content_type, attachments[filename])

    def test_import_with_different_attachment_types(self):
        # Create a directory structure with an XML file and attachments
        instance_dir = os.path.join(self.base_dir, 'instance')
        os.makedirs(instance_dir)

        # Create XML file
        xml_content = '<data id="test_form"><meta><instanceID>uuid:1234</instanceID></meta><name>test</name></data>'
        xml_file_path = os.path.join(instance_dir, 'submission.xml')
        with open(xml_file_path, 'w') as f:
            f.write(xml_content)

        # Create attachments
        attachments = ['test.jpg', 'test.pdf', 'test.mp4']
        for attachment in attachments:
            with open(os.path.join(instance_dir, attachment), 'w') as f:
                f.write('test content')

        # Import instances
        total_count, success_count, errors = import_instances_from_path(self.base_dir, self.user)

        # Assertions
        self.assertEqual(total_count, 1)
        self.assertEqual(success_count, 1)
        self.assertEqual(len(errors), 0)

        # Verify instance and attachments
        instance = Instance.objects.get(uuid='1234')
        self.assertEqual(instance.attachments.count(), 3)
