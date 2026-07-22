from unittest.mock import MagicMock

from django.test import TestCase

from ..utils import _recover_moved_file


class RecoverMovedFileTestCase(TestCase):
    """
    A move is two non-atomic operations: relocate the file, then save the row.
    When the process dies in between (a recycled pod), the retry finds the
    source gone. Telling that apart from a genuinely missing file is what keeps
    the record pointing at the file instead of at nothing.
    """

    def test_repoints_record_when_file_is_already_at_target(self):
        field_file = MagicMock()
        field_file.storage.exists.return_value = True

        recovered = _recover_moved_file(
            field_file, 'anotheruser/attachments', 'someuser/attachments/photo.jpg'
        )

        assert recovered is True
        # The caller saves `name`, so the row now points at the real location.
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
        # Nothing to point at, so the field is left untouched and the caller
        # records the skip.
        assert field_file.name != 'anotheruser/attachments/photo.jpg'
