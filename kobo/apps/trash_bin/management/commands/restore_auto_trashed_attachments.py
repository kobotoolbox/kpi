from datetime import timezone as dt_timezone

from constance import config
from django.apps import apps
from django.conf import settings
from django.core.cache import cache
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django_celery_beat.models import PeriodicTask, PeriodicTasks

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import AuditLog, AuditType
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import Attachment
from kobo.apps.openrosa.apps.logger.models.attachment import AttachmentDeleteStatus
from kobo.apps.openrosa.apps.viewer.models.parsed_instance import ParsedInstance
from kobo.apps.organizations.constants import UsageType
from kobo.apps.trash_bin.models import TrashStatus
from kobo.apps.trash_bin.models.attachment import AttachmentTrash
from kpi.utils.usage_calculator import ServiceUsageCalculator

LOCK_KEY = 'restore_auto_trashed_attachments_lock'
# Refreshed after every chunk, so it only expires if the run dies
LOCK_TTL = 60 * 10


class Command(BaseCommand):

    help = (
        'Restore attachments moved to trash by `auto_delete_excess_attachments` '
        'within a time window, e.g. when `AUTO_DELETE_ATTACHMENTS` was enabled '
        'by mistake, and reset the storage `ExceededLimitCounter` to 0 days. '
        'Users are processed one at a time, in chunks. Only pending trash '
        'entries whose author is the attachment owner are restored. Reports '
        'without writing anything unless `--no-dry-run` is passed. Safe to '
        'interrupt and run again: it continues with what is left in the trash.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--since',
            required=True,
            help='Start of the window (ISO 8601, UTC if no offset is given)',
        )
        parser.add_argument(
            '--until',
            required=True,
            help='End of the window, excluded (ISO 8601, UTC if no offset is given)',
        )
        parser.add_argument(
            '--user-id',
            action='append',
            type=int,
            default=[],
            dest='user_ids',
            metavar='USER_ID',
            help=(
                'Only process this user, and only reset their counter. Repeat for '
                'several users. All users of the window are processed by default.'
            ),
        )
        parser.add_argument(
            '--exclude-user-id',
            action='append',
            type=int,
            default=[],
            dest='excluded_user_ids',
            metavar='USER_ID',
            help=(
                'Do not restore the attachments of this user, e.g. someone who '
                'emptied their own attachments during the window. Repeat for '
                'several users.'
            ),
        )
        parser.add_argument(
            '--author',
            metavar='USERNAME',
            help=(
                'Superuser recorded as the author of the put-back audit logs. '
                'Required with `--no-dry-run`.'
            ),
        )
        parser.add_argument(
            '--chunk-size',
            type=int,
            default=200,
            help='Number of attachments restored per transaction (default: 200)',
        )
        parser.add_argument(
            '--no-dry-run',
            action='store_false',
            dest='dry_run',
            default=True,
            help='Actually restore the attachments, instead of only reporting them',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        user_ids = options['user_ids']
        since = self._parse_datetime(options['since'], '--since')
        until = self._parse_datetime(options['until'], '--until')
        if since >= until:
            raise CommandError('`--since` must be before `--until`')

        if options['chunk_size'] < 1:
            raise CommandError('`--chunk-size` must be a positive integer')

        author = None
        if not dry_run:
            author = self._validate_real_run(options['author'])

        trash_queryset = AttachmentTrash.objects.filter(
            date_created__gte=since,
            date_created__lt=until,
            status=TrashStatus.PENDING,
        ).exclude(request_author_id__in=options['excluded_user_ids'])
        if user_ids:
            trash_queryset = trash_queryset.filter(request_author_id__in=user_ids)

        # {user_id: number of trash entries}, computed by the database in one
        # query rather than by loading all the entries
        counts_per_user = dict(
            trash_queryset.values('request_author_id')
            .annotate(count=Count('pk'))
            .order_by('request_author_id')
            .values_list('request_author_id', 'count')
        )

        # {user_id: <User: john>}, fetched in one query instead of one per user
        users = User.objects.in_bulk(list(counts_per_user))

        prefix = '[DRY RUN] ' if dry_run else ''
        self.stdout.write(
            f'{prefix}{sum(counts_per_user.values())} pending trash entries '
            f'created between {since.isoformat()} and {until.isoformat()} '
            f'for {len(counts_per_user)} user(s)'
        )

        if dry_run:
            if options['verbosity'] > 1:
                for user_id, count in counts_per_user.items():
                    self.stdout.write(
                        f'  User #{user_id} `{users[user_id].username}`: {count}'
                    )
            self._report_storage_counters(user_ids)
            self.stdout.write(
                f'{prefix}Nothing has been changed. Entries whose author is not '
                f'the attachment owner are only detected (and skipped) by the '
                f'real run.'
            )
            return

        # Only one run at a time, two runs would fight over the same rows
        if not cache.add(LOCK_KEY, True, LOCK_TTL):
            raise CommandError('Another run is already in progress')

        try:
            restored_user_ids = self._restore_all(
                counts_per_user, users, trash_queryset, author, options['chunk_size']
            )
            self._reset_storage_counters(user_ids, restored_user_ids)
        finally:
            cache.delete(LOCK_KEY)

    def _validate_real_run(self, username: str | None) -> User:
        """
        Check that a real run can start, and return the superuser to record
        as the author of the put-back audit logs
        """
        if config.AUTO_DELETE_ATTACHMENTS:
            # Restored attachments would be moved back to trash by the next run
            # of `schedule_auto_attachment_cleanup_for_users`
            raise CommandError('Disable `AUTO_DELETE_ATTACHMENTS` first')

        if not username:
            raise CommandError('`--author` is required with `--no-dry-run`')

        try:
            return User.objects.select_related('extra_details').get(
                username=username, is_superuser=True
            )
        except User.DoesNotExist:
            raise CommandError(f'Superuser `{username}` does not exist')

    def _restore_all(
        self,
        counts_per_user: dict[int, int],
        users: dict[int, User],
        trash_queryset,
        author: User,
        chunk_size: int,
    ) -> list[int]:
        """
        Restore the attachments of every user, one user after the other, and
        return the IDs of the users who got at least one attachment back
        """
        restored_user_ids = []
        total_restored = 0
        total_skipped = 0

        try:
            for idx, user_id in enumerate(counts_per_user, start=1):
                restored, skipped = self._restore_user(
                    users[user_id], trash_queryset, author, chunk_size
                )
                total_restored += restored
                total_skipped += skipped
                if restored:
                    restored_user_ids.append(user_id)

                self.stdout.write(
                    f'[{idx}/{len(counts_per_user)}] User #{user_id} '
                    f'`{users[user_id].username}`: {restored} restored, '
                    f'{skipped} skipped'
                )
        finally:
            # Periodic tasks are deleted without signals (see `_restore_chunk()`),
            # so Celery Beat is told once here that its schedule changed
            PeriodicTasks.update_changed()

        self.stdout.write(
            f'Restored {total_restored} attachment(s) for '
            f'{len(restored_user_ids)} user(s), skipped {total_skipped}'
        )
        return restored_user_ids

    def _restore_user(
        self, user: User, trash_queryset, author: User, chunk_size: int
    ) -> tuple[int, int]:
        """
        Restore the attachments of one user, `chunk_size` at a time, until
        none is left. Return how many were restored and how many were skipped
        """
        restored = 0
        skipped = 0
        # Read all the IDs once (a few tens of thousands at most for one user)
        # instead of querying the trash table again for every chunk
        attachment_ids = list(
            trash_queryset.filter(request_author_id=user.pk)
            .order_by('pk')
            .values_list('attachment_id', flat=True)
        )
        for i in range(0, len(attachment_ids), chunk_size):
            chunk = attachment_ids[i:i + chunk_size]
            chunk_restored = self._restore_chunk(user, chunk, author)
            restored += chunk_restored
            skipped += len(chunk) - chunk_restored

            # Keep the lock alive while the run makes progress
            cache.touch(LOCK_KEY, LOCK_TTL)

        if restored:
            # Usage is cached, the user would still see their old storage
            ServiceUsageCalculator(user).clear_cache()

        return restored, skipped

    def _restore_chunk(
        self, user: User, attachment_ids: list[int], author: User
    ) -> int:
        """
        Restore one chunk of attachments and return how many were restored

        It does the same job as `put_back()` (the function behind the admin
        "Put back" action), but does not call it, for three reasons:

        1. `put_back()` updates the row Celery Beat watches every time it is
           called, i.e. thousands of times here. That is the lock which brought
           the server down. Here, it is updated once, at the end of the run.
        2. `put_back()` restores the attachment in the kobocat database first,
           then deletes its trash entry in the KPI database. If the second step
           fails, the attachment looks restored but its trash entry and the
           task that hard-deletes it are still there, and the file would be
           deleted for good later. Here, kobocat is updated last: if it fails,
           the KPI changes are rolled back too and nothing is lost.
        3. `put_back()` raises an error for the whole chunk if one attachment
           is being deleted at that moment. Here, only that attachment is
           skipped.
        """
        # `auto_delete_excess_attachments` always acts as the owner. Entries
        # trashed by someone else (e.g. a collaborator) are left untouched.
        # Attachments already active come from an earlier run stopped between
        # the two database commits, only their trash entry is left to remove
        attachments = list(
            Attachment.all_objects.filter(
                Q(delete_status=AttachmentDeleteStatus.PENDING_DELETE)
                | Q(delete_status__isnull=True),
                pk__in=attachment_ids,
                user_id=user.pk,
            ).values('pk', 'uid', 'media_file_basename', 'instance_id', 'delete_status')
        )
        if not attachments:
            return 0

        with transaction.atomic():
            # Lock the trash entries. An entry already locked by a deletion task
            # running right now is skipped instead of waited for
            locked_trash = list(
                AttachmentTrash.objects.select_for_update(skip_locked=True)
                .filter(
                    attachment_id__in=[att['pk'] for att in attachments],
                    status=TrashStatus.PENDING,
                )
                .values_list('pk', 'attachment_id', 'periodic_task_id')
            )
            if not locked_trash:
                return 0

            locked_attachment_ids = {
                attachment_id for _, attachment_id, _ in locked_trash
            }
            attachments = [
                att for att in attachments if att['pk'] in locked_attachment_ids
            ]

            AttachmentTrash.objects.filter(
                pk__in=[pk for pk, *_ in locked_trash]
            ).delete()
            periodic_tasks = PeriodicTask.objects.filter(
                pk__in=[
                    periodic_task_id
                    for *_, periodic_task_id in locked_trash
                    if periodic_task_id
                ]
            )
            periodic_tasks._raw_delete(periodic_tasks.db)
            AuditLog.objects.bulk_create(
                [
                    AuditLog(
                        app_label=Attachment._meta.app_label,
                        model_name=Attachment._meta.model_name,
                        object_id=att['pk'],
                        user=author,
                        user_uid=author.extra_details.uid,
                        action=AuditAction.PUT_BACK,
                        metadata={
                            'attachment_uid': att['uid'],
                            'attachment_basename': att['media_file_basename'],
                        },
                        log_type=AuditType.ATTACHMENT_MANAGEMENT,
                    )
                    for att in attachments
                ]
            )

            # Kobocat db last: if it fails, everything above is rolled
            # back too. It clears `delete_status` and adds the storage back to
            # the user and project counters
            if uids := [
                att['uid']
                for att in attachments
                if att['delete_status'] == AttachmentDeleteStatus.PENDING_DELETE
            ]:
                AttachmentTrash.toggle_statuses(uids, active=True)

            # Update the `is_deleted` flag in Mongo, so the attachments show up
            # again in the data table and exports. Done before the KPI commit:
            # if Mongo fails, the trash entries are kept and the next run picks
            # these attachments up again
            ParsedInstance.bulk_update_attachments(
                list({att['instance_id'] for att in attachments})
            )

        return len(attachments)

    def _get_storage_counters(self, user_ids: list[int]):
        """
        Return the storage counters the run resets: all of them, or only those
        of `user_ids` when the run is limited to some users
        """
        ExceededLimitCounter = apps.get_model('stripe', 'ExceededLimitCounter')
        counters = ExceededLimitCounter.objects.filter(
            limit_type=UsageType.STORAGE_BYTES
        )
        if user_ids:
            counters = counters.filter(user_id__in=user_ids)
        return counters

    def _report_storage_counters(self, user_ids: list[int]):
        """
        Print how many storage counters a real run would reset, and how many
        of them have already reached the number of days before auto-deletion
        """
        if not settings.STRIPE_ENABLED:
            self.stdout.write('Stripe is disabled, no storage counter to reset')
            return

        counters = self._get_storage_counters(user_ids)
        retention = config.OVER_LIMIT_ATTACHMENT_RETENTION
        self.stdout.write(
            f'Storage counters to reset: {counters.count()} '
            f'({counters.filter(days__gte=retention).count()} at {retention} '
            f'days or more)'
        )

    def _reset_storage_counters(
        self, user_ids: list[int], restored_user_ids: list[int]
    ):
        """
        Restart the countdown before auto-deletion from today: set the storage
        counters to 0 days, and give one back to restored users who lost it
        """
        if not settings.STRIPE_ENABLED:
            return

        # `update()` skips `auto_now`, `date_modified` is set explicitly so the
        # daily increment starts counting from now
        reset_count = self._get_storage_counters(user_ids).update(
            days=0, date_modified=timezone.now()
        )

        # A user back under the limit after the trashing had their counter
        # removed by `update_or_remove_limit_counter()`. Getting the attachments
        # back puts them over the limit again. If some are not, the next run of
        # `update_exceeded_limit_counters` removes their counter
        ExceededLimitCounter = apps.get_model('stripe', 'ExceededLimitCounter')
        existing_user_ids = set(
            ExceededLimitCounter.objects.filter(
                limit_type=UsageType.STORAGE_BYTES, user_id__in=restored_user_ids
            ).values_list('user_id', flat=True)
        )
        created = ExceededLimitCounter.objects.bulk_create(
            [
                ExceededLimitCounter(
                    user_id=user_id, limit_type=UsageType.STORAGE_BYTES, days=0
                )
                for user_id in restored_user_ids
                if user_id not in existing_user_ids
            ]
        )
        self.stdout.write(
            f'Reset {reset_count} storage counter(s), created {len(created)}'
        )

    def _parse_datetime(self, value: str, option: str):
        """
        Convert the text given to `--since` or `--until` into a datetime,
        e.g. `2026-09-30T19:00:00`. Without a timezone, UTC is assumed
        """
        parsed = parse_datetime(value)
        if parsed is None:
            raise CommandError(f'`{option}` is not a valid ISO 8601 datetime')
        if timezone.is_naive(parsed):
            parsed = parsed.replace(tzinfo=dt_timezone.utc)
        return parsed
