from django.core.management.base import BaseCommand, CommandError

from kobo.apps.openrosa.apps.logger.utils.attachment_restore import (
    AttachmentRestorer,
    ProjectAlreadyBeingRestoredError,
    get_project_xform,
    log_collector,
    send_restore_log,
)


class Command(BaseCommand):
    help = (
        'Restore the attachments of a project that were soft deleted by '
        'mistake, i.e. every soft-deleted file its submission still references '
        'at a media question. Reports without writing anything unless '
        '`--no-dry-run` is passed.'
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
        parser.add_argument(
            '--email',
            action='append',
            default=[],
            metavar='ADDRESS',
            help=(
                'Email the log to this address once the run is over, whether it '
                'succeeded or not. Repeat for several recipients.'
            ),
        )

    def handle(self, *args, **options):
        asset_uid = options['asset_uid']
        email_to = options['email']
        dry_run = options['dry_run']
        echo = self.stdout.write if options['verbosity'] > 0 else None

        lines, log = log_collector(echo)

        try:
            # Inside the block that mails the log, which is promised whether the
            # run succeeds or not, a project that cannot be resolved included
            try:
                xform = get_project_xform(asset_uid)
            except ValueError as e:
                raise CommandError(str(e))

            AttachmentRestorer(
                xform,
                dry_run=dry_run,
                resume=options['resume'],
                log=log,
            ).run()
        except ProjectAlreadyBeingRestoredError as e:
            # Not a failure, so it is said plainly rather than as a traceback,
            # and it still reaches the mailbox through the `finally` below
            log(str(e))
            raise CommandError(str(e))
        except Exception as e:
            log(f'FAILED. {type(e).__name__}: {e}')
            raise
        finally:
            if email_to:
                send_restore_log(email_to, asset_uid, lines)

        if dry_run:
            self.stdout.write('Nothing was written. Pass `--no-dry-run` to restore.')
