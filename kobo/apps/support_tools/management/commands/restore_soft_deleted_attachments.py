from django.core.management.base import BaseCommand, CommandError

from kobo.apps.support_tools.exceptions import ProjectAlreadyBeingRestoredError
from kobo.apps.support_tools.utils.helpers import get_project_xform
from kobo.apps.support_tools.utils.logger import RestoreLogger
from kobo.apps.support_tools.utils.restorers.attachment import AttachmentRestorer


class Command(BaseCommand):
    help = (
        'Restore the attachments of a project that were soft deleted by '
        'mistake, i.e. every soft-deleted file its submission still references '
        'at a media question. Reports without writing anything unless '
        '`--no-dry-run` is passed. `-v 2` logs each batch, `-v 3` how each '
        'submission is judged.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--asset-uid',
            metavar='ASSET_UID',
            required=True,
            help='UID of the project (Asset) to inspect and restore',
        )
        parser.add_argument(
            '--no-dry-run',
            action='store_false',
            dest='dry_run',
            default=True,
            help='Actually restore the attachments, instead of only reporting them',
        )
        parser.add_argument(
            '--no-resume',
            action='store_false',
            dest='resume',
            default=True,
            help=(
                'Walk the project from the beginning, throwing away the cursor '
                'an earlier interrupted run left behind'
            ),
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        log = RestoreLogger(options['verbosity'], echo=self.stdout.write)

        try:
            xform = get_project_xform(options['asset_uid'])
        except ValueError as e:
            raise CommandError(str(e))

        try:
            AttachmentRestorer(
                xform, dry_run=dry_run, resume=options['resume'], log=log
            ).run()
        except ProjectAlreadyBeingRestoredError as e:
            # Not a failure, so it is said plainly rather than as a traceback
            raise CommandError(str(e))

        if dry_run:
            log('Nothing was written. Pass `--no-dry-run` to restore.')
