import threading
import uuid
from unittest.mock import patch

from constance.test import override_config
from ddt import data, ddt, unpack
from django.db import connections
from django.db.models import Sum
from django.db.models.signals import post_delete, pre_delete
from django.test import TestCase, TransactionTestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIRequestFactory

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import Attachment, Instance
from kobo.apps.openrosa.apps.logger.models.attachment import AttachmentDeleteStatus
from kobo.apps.openrosa.apps.main.models import UserProfile
from kobo.apps.openrosa.libs.utils import logger_tools
from kobo.apps.openrosa.libs.utils.logger_tools import (
    get_soft_deleted_attachments,
    get_submission_media_basenames,
)
from kobo.apps.project_ownership.utils import create_invite
from kobo.apps.trash_bin.models.attachment import AttachmentTrash
from kobo.apps.trash_bin.utils import move_to_trash, put_back
from kpi.tests.base_test_case import BaseTestCase
from kpi.tests.mixins.create_asset_and_submission_mixin import AssetSubmissionTestMixin
from kpi.tests.utils.transaction import immediate_on_commit
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE
from kpi.utils.django_orm_helper import ReturningUpdateQuerySet


class AttachmentTrashStorageCountersTestCase(BaseTestCase, AssetSubmissionTestMixin):
    """
    Test that moving an attachment to trash and restoring it updates the
    storage counters
    """
    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = User.objects.create(username='owner')
        self.extra = {
            'HTTP_AUTHORIZATION': 'Token %s' % self.user.auth_token
        }
        self.asset, self.xform, self.instance, _, self.attachment = (
            self._create_test_asset_and_submission(user=self.user)
        )

    def test_toggle_statuses_updates_storage_counters(self):
        """
        Toggling an attachment to trash should decrease storage counters.
        Toggling it back should restore them.
        """
        # Check initial values
        self._refresh_all()
        self.assertIsNotNone(self.attachment.media_file_size)
        self.assertGreater(self.xform.attachment_storage_bytes, 0)
        self.assertGreater(self._get_user_storage(self.user), 0)
        original_xform_bytes = self.xform.attachment_storage_bytes
        original_user_bytes = self._get_user_storage(self.user)

        # Move the attachment to trash
        self._move_to_trash()

        # Counters should be decremented
        self.assertEqual(self.xform.attachment_storage_bytes, 0)
        self.assertEqual(self._get_user_storage(self.user), 0)
        self.assertEqual(
            self.attachment.delete_status, AttachmentDeleteStatus.PENDING_DELETE
        )

        # Restore the attachment
        self._put_back_from_trash()

        # Counters should be restored to original values
        self.assertEqual(self.xform.attachment_storage_bytes, original_xform_bytes)
        self.assertEqual(self._get_user_storage(self.user), original_user_bytes)
        self.assertIsNone(self.attachment.delete_status)

    def test_toggling_twice_does_not_count_storage_twice(self):
        """
        Trashing (or restoring) an attachment already trashed (or restored)
        must not change the counters again
        """
        self._refresh_all()
        size = self.attachment.media_file_size
        self.assertEqual(self._get_user_storage(self.user), size)
        self.assertEqual(self.xform.attachment_storage_bytes, size)

        for expected_updated in (1, 0):
            _, updated = AttachmentTrash.toggle_statuses(
                [self.attachment.uid], active=False
            )
            self._refresh_all()
            self.assertEqual(updated, expected_updated)
            self.assertEqual(self._get_user_storage(self.user), 0)
            self.assertEqual(self.xform.attachment_storage_bytes, 0)

        for expected_updated in (1, 0):
            _, updated = AttachmentTrash.toggle_statuses(
                [self.attachment.uid], active=True
            )
            self._refresh_all()
            self.assertEqual(updated, expected_updated)
            self.assertEqual(self._get_user_storage(self.user), size)
            self.assertEqual(self.xform.attachment_storage_bytes, size)

    def test_counters_of_each_user_and_project_are_updated(self):
        """
        Attachments of several users and projects toggled at once update the
        counters of their own user and project only
        """
        other_user = User.objects.create(username='other_owner')
        _, other_xform, _, _, other_attachment = self._create_test_asset_and_submission(
            user=other_user
        )
        self._refresh_all()
        other_xform.refresh_from_db()
        other_size = other_attachment.media_file_size
        self.assertEqual(self._get_user_storage(other_user), other_size)

        # Only the other user's attachment changes, the first one is already
        # trashed
        AttachmentTrash.toggle_statuses([self.attachment.uid], active=False)
        AttachmentTrash.toggle_statuses(
            [self.attachment.uid, other_attachment.uid], active=False
        )

        self._refresh_all()
        other_xform.refresh_from_db()
        self.assertEqual(self._get_user_storage(self.user), 0)
        self.assertEqual(self.xform.attachment_storage_bytes, 0)
        self.assertEqual(self._get_user_storage(other_user), 0)
        self.assertEqual(other_xform.attachment_storage_bytes, 0)

    def test_deleting_submission_does_not_decrease_counters_twice(self):
        """
        Test that storage counters are not decremented twice when an attachment
        is trashed and its parent submission is later deleted
        """
        # Move the attachment to trash
        self._move_to_trash()
        decremented_xform_bytes = self.xform.attachment_storage_bytes
        decremented_user_bytes = self._get_user_storage(self.user)

        # Delete the submission
        submission_detail_url = reverse(
            self._get_endpoint('submission-detail'),
            kwargs={
                'uid_asset': self.asset.uid,
                'pk': self.instance.pk,
            },
        )
        self.client.force_login(self.user)
        response = self.client.delete(submission_detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        self.xform.refresh_from_db()

        # Verify that the attachment storage counter is not decreased twice
        self.assertEqual(self.xform.attachment_storage_bytes, decremented_xform_bytes)
        self.assertEqual(self._get_user_storage(self.user), decremented_user_bytes)

    def _move_to_trash(self):
        """
        Move the attachment to trash and refresh all objects
        """
        move_to_trash(
            request_author=self.user,
            objects_list=[{
                'pk': self.attachment.pk,
                'asset_id': self.asset.pk,
                'asset_uid': self.asset.uid,
                'attachment_uid': self.attachment.uid,
                'attachment_basename': self.attachment.media_file_basename,
            }],
            grace_period=1,
            trash_type='attachment',
            retain_placeholder=False,
        )
        self._refresh_all()

    def _put_back_from_trash(self):
        """
        Restore the attachment from trash and refresh all objects
        """
        put_back(
            request_author=self.user,
            objects_list=[{
                'pk': self.attachment.pk,
                'attachment_uid': self.attachment.uid,
                'attachment_basename': self.attachment.media_file_basename,
            }],
            trash_type='attachment',
        )
        self._refresh_all()

    def _refresh_all(self):
        """
        Refresh all relevant objects from the database to get updated values.
        """
        self.attachment.refresh_from_db()
        self.xform.refresh_from_db()


class TransferredProjectAttachmentTrashCounterTestCase(
    TestCase, AssetSubmissionTestMixin
):
    """
    Tests that attachment counters update correctly when a transferred project's
    attachments are trashed and restored.
    """
    def setUp(self):
        self.owner = User.objects.create(username='owner')
        self.new_owner = User.objects.create(username='new_owner')
        UserProfile.objects.create(user=self.new_owner)
        self.asset, self.xform, self.instance, _, self.attachment = (
            self._create_test_asset_and_submission(user=self.owner)
        )

    def test_counters_are_updated_when_attachments_are_trashed_after_transfer(self):
        # Initial state: attachment belongs to original owner
        xform_storage_init = self.xform.attachment_storage_bytes
        owner_storage_init = self._get_user_storage(self.owner)
        new_owner_storage_init = self._get_user_storage(self.new_owner)

        self.assertGreater(xform_storage_init, 0)
        self.assertGreater(owner_storage_init, 0)
        self.assertEqual(new_owner_storage_init, 0)

        # 1. Transfer the project to another user
        self._transfer_project()

        self._refresh_all()
        xform_storage_after_transfer = self.xform.attachment_storage_bytes
        owner_storage_after_transfer = self._get_user_storage(self.owner)
        new_owner_storage_after_transfer = self._get_user_storage(self.new_owner)

        self.assertGreater(xform_storage_after_transfer, 0)
        self.assertEqual(owner_storage_after_transfer, 0)
        self.assertGreater(new_owner_storage_after_transfer, 0)
        self.assertEqual(new_owner_storage_after_transfer, owner_storage_init)

        # 2. Move the attachments to trash
        move_to_trash(
            request_author=self.new_owner,
            objects_list=[{
                'pk': self.attachment.pk,
                'asset_id': self.asset.pk,
                'asset_uid': self.asset.uid,
                'attachment_uid': self.attachment.uid,
                'attachment_basename': self.attachment.media_file_basename,
            }],
            grace_period=1,
            trash_type='attachment',
            retain_placeholder=False,
        )
        self._refresh_all()

        xform_storage_after_trash = self.xform.attachment_storage_bytes
        owner_storage_after_trash = self._get_user_storage(self.owner)
        new_owner_storage_after_trash = self._get_user_storage(self.new_owner)

        # After trash: all counters should be 0
        self.assertEqual(xform_storage_after_trash, 0)
        self.assertEqual(owner_storage_after_trash, 0)
        self.assertEqual(new_owner_storage_after_trash, 0)

        # 3. Restore the attachments from trash
        put_back(
            request_author=self.new_owner,
            objects_list=[{
                'pk': self.attachment.pk,
                'attachment_uid': self.attachment.uid,
                'attachment_basename': self.attachment.media_file_basename,
            }],
            trash_type='attachment',
        )
        self._refresh_all()

        xform_storage_after_restore = self.xform.attachment_storage_bytes
        owner_storage_after_restore = self._get_user_storage(self.owner)
        new_owner_storage_after_restore = self._get_user_storage(self.new_owner)

        # After restore: values should match post-transfer values
        self.assertEqual(xform_storage_after_restore, xform_storage_after_transfer)
        self.assertEqual(owner_storage_after_restore, 0)
        self.assertEqual(
            new_owner_storage_after_restore, new_owner_storage_after_transfer
        )

    @override_config(PROJECT_OWNERSHIP_AUTO_ACCEPT_INVITES=True)
    def _transfer_project(self):
        """
        Helper method to transfer the project to another user
        """
        with immediate_on_commit():
            create_invite(
                self.owner,
                self.new_owner,
                [self.asset],
                'Invite'
            )
        self._refresh_all()
        assert self.asset.owner == self.new_owner

    def _refresh_all(self):
        """
        Refresh all test objects from the database to get updated values
        """
        self.asset.refresh_from_db()
        self.xform.refresh_from_db()


@ddt
class AttachmentTrashConcurrentStorageCountersTestCase(
    TransactionTestCase, AssetSubmissionTestMixin
):
    """
    Two requests changing the same attachment at the same time must subtract
    its size once. The second one waits for the first one to commit, then
    changes nothing, and must count nothing
    """

    def test_concurrent_trash_subtracts_once(self):
        user = User.objects.create(username='owner')
        _, xform, _, _, attachment = self._create_test_asset_and_submission(user=user)
        xform.refresh_from_db()
        storage_before = self._get_user_storage(user)
        size = attachment.media_file_size

        barrier = threading.Barrier(2)
        updated = []

        def trash():
            try:
                barrier.wait()
                _, count = AttachmentTrash.toggle_statuses(
                    [attachment.uid], active=False
                )
                updated.append(count)
            finally:
                connections.close_all()

        threads = [threading.Thread(target=trash) for _ in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        xform.refresh_from_db()
        self.assertEqual(sorted(updated), [0, 1])
        self.assertEqual(self._get_user_storage(user), storage_before - size)
        self.assertEqual(xform.attachment_storage_bytes, storage_before - size)

    def test_concurrent_trash_and_submission_deletion_subtract_once(self):
        """
        Trashing an attachment while its submission is deleted must subtract
        its size once, whichever commits first. The deletion counts the rows
        as it deletes them, so it skips an attachment the trash just counted.
        """
        user = User.objects.create(username='owner')
        asset, xform, instance, _, attachment = self._create_test_asset_and_submission(
            user=user
        )
        xform.refresh_from_db()
        assert attachment.media_file_size > 0
        assert xform.attachment_storage_bytes == attachment.media_file_size

        barrier = threading.Barrier(2)
        errors = []

        def trash():
            try:
                barrier.wait()
                AttachmentTrash.toggle_statuses([attachment.uid], active=False)
            except Exception as e:
                errors.append(e)
            finally:
                connections.close_all()

        def delete_submission():
            try:
                barrier.wait()
                asset.deployment.delete_submissions(
                    {'submission_ids': [instance.pk], 'query': ''}, user
                )
            except Exception as e:
                errors.append(e)
            finally:
                connections.close_all()

        threads = [
            threading.Thread(target=trash),
            threading.Thread(target=delete_submission),
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        assert errors == []
        xform.refresh_from_db()
        assert xform.attachment_storage_bytes == 0
        assert self._get_user_storage(user) == 0

    def test_deletion_does_not_subtract_an_attachment_trashed_meanwhile(self):
        """
        Force the order that used to count twice: the submission deletion has
        started, and another request trashes one of its attachments and commits
        right before the attachments are deleted. The trash already subtracted
        the size, so the deletion must not subtract it again.

        The former code read the attachments first and deleted them afterwards,
        so it still saw the attachment active and subtracted it a second time.
        """
        user = User.objects.create(username='owner')
        asset, xform, instance, _, attachment = self._create_test_asset_and_submission(
            user=user
        )
        xform.refresh_from_db()
        assert attachment.media_file_size > 0
        assert xform.attachment_storage_bytes == attachment.media_file_size

        real_delete_returning = ReturningUpdateQuerySet.delete_returning
        trashed = []

        def trash_then_delete(queryset, *args, **kwargs):
            # Trash the attachment from another connection, and wait for it to
            # commit, right before the deletion deletes it
            if not trashed:
                trashed.append(True)
                self._run_in_thread(self._trash, attachment)
            return real_delete_returning(queryset, *args, **kwargs)

        with patch.object(
            ReturningUpdateQuerySet,
            'delete_returning',
            autospec=True,
            side_effect=trash_then_delete,
        ):
            asset.deployment.delete_submissions(
                {'submission_ids': [instance.pk], 'query': ''}, user
            )

        assert trashed
        xform.refresh_from_db()
        assert xform.attachment_storage_bytes == 0
        assert self._get_user_storage(user) == 0

    @data(
        # (submissions deleted by the first call, by the concurrent one)
        ('both', 'both'),
        ('both', 'first'),
        ('first', 'both'),
    )
    @unpack
    def test_concurrent_deletions_of_the_same_submissions_subtract_once(
        self, first_call, concurrent_call
    ):
        """
        Two deletions sharing submissions: the first one has already listed its
        submissions when the other one deletes some of them and commits, right
        before the first one deletes their attachments. Each attachment must be
        subtracted once, by whichever call actually deletes it.
        """
        user = User.objects.create(username='owner')
        asset, xform, first_instance, _, _ = self._create_test_asset_and_submission(
            user=user
        )
        second_instance = self._add_submission(asset, user)
        submission_ids = {
            'first': [first_instance.pk],
            'both': [first_instance.pk, second_instance.pk],
        }
        xform.refresh_from_db()
        assert xform.attachment_storage_bytes > 0

        real_delete_returning = ReturningUpdateQuerySet.delete_returning
        deleted_meanwhile = []

        def delete_concurrently_then_delete(queryset, *args, **kwargs):
            # Run the other deletion to completion, on another connection, right
            # before this one deletes the attachments
            if not deleted_meanwhile:
                deleted_meanwhile.append(True)
                # `delete_instances()` disconnects signals while it runs and
                # reconnects them when it ends, and signals are shared by the
                # whole process. In production, two deletions never share a
                # process (uWSGI and Celery workers are single-threaded
                # processes), but this test runs both in one: stop the other
                # deletion from reconnecting them while this one still runs.
                with patch.object(pre_delete, 'connect'), patch.object(
                    post_delete, 'connect'
                ):
                    self._run_in_thread(
                        self._delete_submissions,
                        asset,
                        user,
                        submission_ids[concurrent_call],
                    )
            return real_delete_returning(queryset, *args, **kwargs)

        with patch.object(
            ReturningUpdateQuerySet,
            'delete_returning',
            autospec=True,
            side_effect=delete_concurrently_then_delete,
        ):
            self._delete_submissions(asset, user, submission_ids[first_call])

        assert deleted_meanwhile
        xform.refresh_from_db()
        remaining = (
            Attachment.all_objects.filter(xform_id=xform.pk).aggregate(
                total=Sum('media_file_size')
            )['total']
            or 0
        )
        assert xform.attachment_storage_bytes == remaining
        if first_call == 'both' or concurrent_call == 'both':
            assert xform.attachment_storage_bytes == 0

    def test_edit_does_not_subtract_an_attachment_trashed_meanwhile(self):
        """
        An edit picks the attachments its submission no longer references, then
        soft deletes them. If another request trashes one of them in between,
        the trash already subtracted its size, so the edit must not return it
        for the caller to subtract again.
        """
        user = User.objects.create(username='owner')
        _, xform, instance, _, attachment = self._create_test_asset_and_submission(
            user=user
        )
        # The submission now references another file, so the attachment is to
        # be soft deleted
        Instance.objects.filter(pk=instance.pk).update(
            xml=instance.xml.replace(attachment.media_file_basename, 'other.3gp')
        )
        instance.refresh_from_db()
        assert get_submission_media_basenames(instance) == {'other.3gp'}

        real_now = timezone.now
        trashed = []

        def trash_then_now():
            # `now()` is called right after the attachments are picked and
            # right before the `UPDATE`: trash the attachment there, from
            # another connection, and wait for it to commit
            if not trashed:
                trashed.append(True)
                self._run_in_thread(self._trash, attachment)
            return real_now()

        with patch.object(logger_tools.dj_timezone, 'now', side_effect=trash_then_now):
            soft_deleted = get_soft_deleted_attachments(instance)

        assert trashed
        assert soft_deleted == []
        attachment.refresh_from_db()
        assert attachment.delete_status == AttachmentDeleteStatus.PENDING_DELETE
        xform.refresh_from_db()
        assert xform.attachment_storage_bytes == 0

    def _add_submission(self, asset, user) -> Instance:
        """
        Add another submission with an attachment to the project
        """
        submission_uuid = str(uuid.uuid4())
        asset.deployment.mock_submissions(
            [
                {
                    'q1': 'audio_conversion_test_clip.3gp',
                    '_uuid': submission_uuid,
                    '_attachments': [
                        {
                            'download_url': f'http://testserver/{user.username}/audio_conversion_test_clip.3gp',  # noqa: E501
                            'filename': f'{user.username}/audio_conversion_test_clip.3gp',  # noqa: E501
                            'mimetype': 'video/3gpp',
                        },
                    ],
                    '_submitted_by': user.username,
                }
            ]
        )
        return Instance.objects.get(root_uuid=submission_uuid)

    def _delete_submissions(self, asset, user, submission_ids: list[int]):
        asset.deployment.delete_submissions(
            {'submission_ids': submission_ids, 'query': ''}, user
        )

    def _run_in_thread(self, target, *args):
        """
        Run `target` in another thread, so on its own database connection, and
        wait for it to finish. Re-raise what it raised.
        """
        errors = []

        def run():
            try:
                target(*args)
            except Exception as e:
                errors.append(e)
            finally:
                connections.close_all()

        thread = threading.Thread(target=run)
        thread.start()
        thread.join()
        if errors:
            raise errors[0]

    def _trash(self, attachment):
        AttachmentTrash.toggle_statuses([attachment.uid], active=False)
