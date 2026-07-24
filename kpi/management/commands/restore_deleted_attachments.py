from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone as dj_timezone

from kobo.apps.openrosa.apps.logger.models import Attachment, Instance
from kobo.apps.openrosa.apps.viewer.models.parsed_instance import ParsedInstance
from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage as default_storage,
)
from kpi.models import Asset


class Command(BaseCommand):

    help = (
        'Restore Attachment rows of a project that were wrongly deleted by a '
        'cross-project bulk deletion. The metadata is read back from MongoDB '
        '(which still references the attachments) and the rows are recreated '
        'only when the underlying file is still present on storage. MongoDB is '
        'left untouched.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--asset-uid',
            required=True,
            help='UID of the project (Asset) to inspect and restore',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            default=False,
            help='Only report what would be restored, without writing anything',
        )

    def handle(self, *args, **options):
        asset_uid = options['asset_uid']
        dry_run = options['dry_run']
        self._verbosity = options['verbosity']

        try:
            asset = Asset.objects.defer('content').get(uid=asset_uid)
        except Asset.DoesNotExist:
            raise CommandError(f'Asset `{asset_uid}` does not exist')

        if not asset.has_deployment:
            raise CommandError(f'Asset `{asset_uid}` is not deployed')

        deployment = asset.deployment
        xform = deployment.xform

        if dry_run:
            self.stdout.write('⚠ Dry run: no change will be written')

        restored = 0
        already_present = 0
        unrecoverable = 0

        # MongoDB still holds the metadata of the deleted attachments, so we
        # read the submissions from there (the owner has full access).
        submissions = deployment.get_submissions(
            user=asset.owner,
            fields=['_id', '_attachments'],
        )

        for submission in submissions:
            instance_id = submission['_id']
            instance = None
            affected = False
            attachments = submission['_attachments'] or []

            for attachment in attachments:
                # Attachments flagged as deleted in MongoDB were removed on purpose;
                #  never bring those back.
                if attachment.get('is_deleted'):
                    continue

                media_file = attachment.get('filename')
                if not media_file:
                    continue

                # `media_file` is the storage path and is unique; use it to tell
                # whether the row is still there (including soft-deleted ones).
                if Attachment.all_objects.filter(
                    instance_id=instance_id, media_file=media_file
                ).exists():
                    already_present += 1
                    continue

                # The row is gone: this submission was hit by the bug.
                affected = True

                # Only restore when the original file is still present. We do not
                # fall back to the surviving `<media_file>.mp3` transcode: it
                # would leave the UI broken since MongoDB still references the
                # original filename and is intentionally left untouched.
                if not default_storage.exists(media_file):
                    unrecoverable += 1
                    self.stderr.write(
                        f'\tInstance #{instance_id}: cannot restore '
                        f'`{media_file}` (file missing from storage)'
                    )
                    continue

                if self._verbosity > 0:
                    prefix = 'Would restore' if dry_run else 'Restoring'
                    self.stdout.write(
                        f'\tInstance #{instance_id}: {prefix} `{media_file}`'
                    )

                if not dry_run:
                    if instance is None:
                        instance = Instance.objects.get(pk=instance_id)
                    self._restore_attachment(instance, media_file, attachment, xform)

                restored += 1

            # The bug also deleted the ParsedInstance row of every affected
            # submission; recreate it even when the file itself is lost.
            if affected and not dry_run:
                if instance is None:
                    instance = Instance.objects.get(pk=instance_id)
                self._ensure_parsed_instance(instance)

        self.stdout.write(
            'Done! '
            f'{restored} attachment(s) {"to restore" if dry_run else "restored"}, '
            f'{already_present} already present, '
            f'{unrecoverable} unrecoverable (file missing).'
        )
        if not dry_run and restored:
            self.stdout.write(
                'Storage counters were left untouched. Run '
                '`update_attachment_storage_bytes` if they need to be '
                'recalculated.'
            )

    def _ensure_parsed_instance(self, instance: Instance):
        """
        Recreate the ParsedInstance row of `instance` if it is missing, without
        writing to MongoDB. `ParsedInstance.save()` would resync Mongo, which
        must be left untouched here.
        """
        if ParsedInstance.objects.filter(instance=instance).exists():
            return

        parsed_instance = ParsedInstance(instance=instance)
        parsed_instance._set_geopoint()
        parsed_instance.set_submitted_by()
        # Bypass `ParsedInstance.save()` to avoid the MongoDB resync it performs.
        super(ParsedInstance, parsed_instance).save()

    def _restore_attachment(
        self,
        instance: Instance,
        media_file: str,
        attachment_data: dict,
        xform: 'XForm',
    ):
        """
        Recreate a single Attachment row pointing at the file already present on
        storage. The file is not re-uploaded: assigning the stored path to the
        `FileField` marks it as already committed.
        """
        attachment = Attachment(
            instance=instance,
            media_file=media_file,
            media_file_basename=attachment_data.get('media_file_basename'),
            mimetype=attachment_data.get('mimetype') or '',
            xform_id=xform.id,
            user_id=xform.user_id,
            date_created=instance.date_created,
            date_modified=dj_timezone.now(),
        )
        # Storage counters were not decremented for this project when the bug
        # struck, so they must not be incremented again here.
        attachment.defer_counting = True
        attachment.save()
