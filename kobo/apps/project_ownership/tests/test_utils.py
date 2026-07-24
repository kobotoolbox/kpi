from unittest.mock import MagicMock

from django.test import TestCase

from ..utils import _recover_moved_file


class RecoverMovedFileTestCase(TestCase):
    """
    A move relocates the file then saves the row. A crash in between leaves the
    source gone but the file present at the target.
    """

    def test_repoints_record_when_file_is_already_at_target(self):
        field_file = MagicMock()
        field_file.storage.exists.return_value = True

        recovered = _recover_moved_file(
            field_file, 'anotheruser/attachments', 'someuser/attachments/photo.jpg'
        )

        assert recovered is True
        assert field_file.name == 'anotheruser/attachments/photo.jpg'
        field_file.storage.exists.assert_called_once_with(
            'anotheruser/attachments/photo.jpg'
        )

    def test_reports_missing_when_file_is_at_neither_path(self):
        field_file = MagicMock()
        field_file.storage.exists.return_value = False

        recovered = _recover_moved_file(
            field_file, 'anotheruser/attachments', 'someuser/attachments/photo.jpg'
        )

        assert recovered is False
        # Nothing to point at, so the field is left untouched.
        assert field_file.name != 'anotheruser/attachments/photo.jpg'
