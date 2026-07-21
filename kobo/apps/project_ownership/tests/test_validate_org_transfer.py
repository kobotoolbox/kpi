from unittest.mock import MagicMock, patch

from django.test import TestCase

from kobo.apps.project_ownership.management.commands.validate_org_transfer import (
    Command,
)


class ValidateOrgTransferMissingFileTestCase(TestCase):

    def test_missing_s3_attachment_is_not_a_failure(self):
        # One misplaced attachment whose file is absent from BOTH the old and
        # the new S3 path (genuinely gone). Under the new rule this is OK.
        command = Command()

        asset = MagicMock()
        asset.deployment.get_submissions.return_value = [{'_id': 1}]

        misplaced_attachment = MagicMock(pk=42)
        misplaced_attachment.media_file.name = 'someuser/audio.jpg'

        def attachment_filter(*args, **kwargs):
            qs = MagicMock()
            qs.count.return_value = 1
            qs.only.return_value = qs
            qs.iterator.return_value = iter([misplaced_attachment])

            def exclude(*eargs, **ekwargs):
                if 'user__username' in ekwargs:
                    # Separate queryset used solely to count attachments
                    # still owned by the wrong user; none in this scenario.
                    wrong_user_qs = MagicMock()
                    wrong_user_qs.count.return_value = 0
                    return wrong_user_qs
                return qs  # exclude(media_file__startswith=...) for `misplaced`

            qs.exclude.side_effect = exclude
            return qs

        with patch(
            'kobo.apps.project_ownership.management.commands.'
            'validate_org_transfer.Attachment.all_objects.filter',
            side_effect=attachment_filter,
        ), patch(
            'kobo.apps.project_ownership.management.commands.'
            'validate_org_transfer.get_target_folder',
            return_value='anotheruser',
        ), patch(
            'kobo.apps.project_ownership.management.commands.'
            'validate_org_transfer.default_kobocat_storage.exists',
            return_value=False,  # missing on both old and new paths
        ):
            ok, detail = command._check_attachments(
                asset, 'anotheruser', MagicMock(), dry_run=True
            )

        assert ok is True
        assert 'OK (data already gone)' in detail
