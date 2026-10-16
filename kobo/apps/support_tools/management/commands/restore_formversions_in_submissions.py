from django.core.management.base import BaseCommand, CommandError

from kobo.apps.support_tools.exceptions import ProjectAlreadyBeingRestoredError
from kobo.apps.support_tools.utils.helpers import get_project_xform
from kobo.apps.support_tools.utils.logger import RestoreLogger
from kobo.apps.support_tools.utils.restorers.attachment import AttachmentRestorer
from kobo.apps.support_tools.utils.restorers.form_versions import (
    FormVersionsRestorer,
)


class Command(BaseCommand):
    help = (
        'Record `meta/formVersions` in the submissions of a project that went'
        ' through several form versions before the server started recording'
        ' them, i.e. submissions edited under a newer version or collected'
        ' offline with an older one. Reports without writing anything unless'
        ' `--no-dry-run` is passed. `-v 2` logs each batch, `-v 3` how each'
        ' submission history is rebuilt.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--asset-uid',
            metavar='ASSET_UID',
            required=True,
            help='UID of the project (Asset) to inspect and update',
        )
        parser.add_argument(
            '--no-dry-run',
            action='store_false',
            dest='dry_run',
            default=True,
            help='Actually update the submissions, instead of only reporting them',
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
        parser.add_argument(
            '--restore-attachments',
            action='store_true',
            default=False,
            help=(
                'Once every submission is updated, run the attachment restore '
                '(`restore_soft_deleted_attachments`) on the same project, in the '
                'same mode and from the start. It can then see files kept under a '
                'question name only an intermediate form version had.'
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
            restorer = FormVersionsRestorer(
                xform, dry_run=dry_run, resume=options['resume'], log=log
            )
            restorer.run()

            if options['restore_attachments'] and restorer.completed:
                if dry_run:
                    log(
                        'Nothing was written above, so the attachment count below'
                        ' may be low: files under a question only an intermediate'
                        ' version had are found once the versions are recorded.'
                    )
                # From the start: a cursor that an earlier attachment run left behind
                # was placed before the versions were recorded, and would skip the files
                # they now account for
                AttachmentRestorer(xform, dry_run=dry_run, resume=False, log=log).run()
            elif restorer.updated and not dry_run:
                log(
                    'Run `restore_soft_deleted_attachments` on this project to'
                    ' bring back files the recorded versions now account for.'
                )
        except ProjectAlreadyBeingRestoredError as e:
            # Not a failure, so it is said plainly rather than as a traceback
            raise CommandError(str(e))

        if dry_run:
            log('Nothing was written. Pass `--no-dry-run` to update.')
