from io import StringIO

import pytest
from django.core.cache import cache
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.constants import (
    RECOUNT_STORAGE_COMMAND_CURSOR_KEY_PREFIX,
)
from kobo.apps.openrosa.apps.logger.models import Attachment, XForm
from kobo.apps.openrosa.apps.logger.models.attachment import AttachmentDeleteStatus
from kpi.tests.mixins.create_asset_and_submission_mixin import AssetSubmissionTestMixin


class UpdateAttachmentStorageBytesTestCase(TestCase, AssetSubmissionTestMixin):

    all_cursor_key = f'{RECOUNT_STORAGE_COMMAND_CURSOR_KEY_PREFIX}all:fix'

    def setUp(self):
        cache.delete_pattern(f'{RECOUNT_STORAGE_COMMAND_CURSOR_KEY_PREFIX}*')
        self.user = User.objects.create(username='storageuser')
        self.other_user = User.objects.create(username='otheruser')
        self.suspect = self._create_test_asset_and_submission(user=self.user)[1]
        self.size = self.suspect.attachment_storage_bytes
        assert self.size

        # Suspect, and too high: its attachment was trashed without its size
        # being subtracted
        Attachment.all_objects.filter(xform_id=self.suspect.pk).update(
            delete_status=AttachmentDeleteStatus.PENDING_DELETE
        )
        # Not suspect, but wrong: only an explicit selection recounts it,
        # unless its owner is active
        self.other = self._create_test_asset_and_submission(user=self.other_user)[1]
        XForm.all_objects.filter(pk=self.other.pk).update(
            attachment_storage_bytes=self.size + 123
        )

    def tearDown(self):
        cache.delete_pattern(f'{RECOUNT_STORAGE_COMMAND_CURSOR_KEY_PREFIX}*')

    def test_default_fixes_suspects(self):
        call_command('update_attachment_storage_bytes', verbosity=0, stdout=StringIO())

        assert self._counter(self.suspect) == 0

    def test_dry_run_fixes_nothing(self):
        stdout = StringIO()
        call_command(
            'update_attachment_storage_bytes',
            all=True,
            dry_run=True,
            stdout=stdout,
        )

        assert self._counter(self.suspect) == self.size
        assert self._counter(self.other) == self.size + 123
        assert '2 drifted' in stdout.getvalue()

    def test_username_recounts_every_project_of_the_user_only(self):
        XForm.all_objects.filter(pk=self.suspect.pk).update(attachment_storage_bytes=7)
        Attachment.all_objects.filter(xform_id=self.suspect.pk).update(
            delete_status=None
        )

        call_command(
            'update_attachment_storage_bytes',
            username=self.user.username,
            verbosity=0,
            stdout=StringIO(),
        )

        assert self._counter(self.suspect) == self.size
        assert self._counter(self.other) == self.size + 123

    def test_unknown_username_raises(self):
        with pytest.raises(CommandError):
            call_command(
                'update_attachment_storage_bytes',
                username='nobody',
                verbosity=0,
            )

    def test_all_fixes_every_project(self):
        call_command(
            'update_attachment_storage_bytes',
            all=True,
            verbosity=0,
            stdout=StringIO(),
        )

        assert self._counter(self.suspect) == 0
        assert self._counter(self.other) == self.size

    def test_interrupted_run_resumes_where_it_stopped(self):
        cache.set(self.all_cursor_key, max(self.suspect.pk, self.other.pk))

        call_command(
            'update_attachment_storage_bytes',
            all=True,
            verbosity=0,
            stdout=StringIO(),
        )

        assert self._counter(self.suspect) == self.size
        assert self._counter(self.other) == self.size + 123
        # The run went to the end, the next one starts over
        assert cache.get(self.all_cursor_key) is None

    def test_force_starts_over(self):
        cache.set(self.all_cursor_key, max(self.suspect.pk, self.other.pk))

        call_command(
            'update_attachment_storage_bytes',
            all=True,
            force=True,
            verbosity=0,
            stdout=StringIO(),
        )

        assert self._counter(self.suspect) == 0
        assert self._counter(self.other) == self.size

    def _counter(self, xform: XForm) -> int:
        return XForm.all_objects.values_list('attachment_storage_bytes', flat=True).get(
            pk=xform.pk
        )
