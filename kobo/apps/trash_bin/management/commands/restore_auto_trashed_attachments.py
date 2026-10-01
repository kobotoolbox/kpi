from collections import defaultdict
from datetime import datetime
from datetime import timezone as dt_timezone

from constance import config
from django.apps import apps
from django.conf import settings
from django.core.cache import cache
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import BooleanField, Count, Q
from django.db.models.expressions import RawSQL
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
# Print a progress line every N chunks
PROGRESS_EVERY = 50
# How long the position of an interrupted run is kept (see `_get_saved_position()`)
POSITION_TTL = 60 * 60 * 24 * 7


class Command(BaseCommand):

    help = (
        'Restore attachments moved to trash by `auto_delete_excess_attachments` '
        'within a time window, e.g. when `AUTO_DELETE_ATTACHMENTS` was enabled '
        'by mistake, and restart the storage `ExceededLimitCounter` from '
        '`--since`, the day enforcement was enabled. '
        'Users are processed one at a time, in chunks. Only pending trash '
        'entries trashed as the owner, and not newer than the oldest attachment '
        'the owner still has, are restored: the others were trashed by a '
        'person. Reports without writing anything unless `--no-dry-run` is '
        'passed. Safe to interrupt and run again: it continues with what is '
        'left in the trash. If it stops with an error, run it again. '
        'Attachments left `pending-delete` without any trash entry (orphans, '
        'when auto-deletion was killed half-way) are restored too.'
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
            '--from-start',
            action='store_true',
            default=False,
            help=(
                'Ignore the position saved by an interrupted run with the same '
                'options, and read everything again from the start of the window'
            ),
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
            self._report_orphans(options, since, until)
            self._report_storage_counters(user_ids, since)
            self.stdout.write(
                f'{prefix}Nothing has been changed. Entries trashed by a person '
                f'(a collaborator, or the owner themselves) are only detected, '
                f'and left in trash, by the real run.'
            )
            return

        # Only one run at a time, two runs would fight over the same rows
        if not cache.add(LOCK_KEY, True, LOCK_TTL):
            raise CommandError('Another run is already in progress')

        try:
            restored_user_ids = self._restore_all(
                counts_per_user,
                users,
                trash_queryset,
                author,
                since,
                options,
            )
            restored_user_ids = sorted(
                set(restored_user_ids)
                | self._restore_orphans(options, since, until)
            )
            self._reset_storage_counters(user_ids, restored_user_ids, since)
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
        since: datetime,
        options: dict,
    ) -> set[int]:
        """
        Restore the attachments of every trash entry of the window, and return
        the IDs of the users who got at least one attachment back

        Entries are read `--chunk-size` at a time in primary key order (they
        were all created during the window, so their keys follow each other),
        then grouped by user. Nothing grows with the number of entries, and
        the position is saved after every chunk, so a run killed half-way
        continues from there (see `_get_saved_position()`).
        """
        # {user_id: [restored, kept, skipped]}
        stats = {user_id: [0, 0, 0] for user_id in counts_per_user}
        cutoffs = {}
        position_key = self._get_position_key('trash', options)
        last_pk = self._get_saved_position(position_key, options) or 0

        try:
            idx = 0
            while True:
                chunk = list(
                    trash_queryset.filter(pk__gt=last_pk)
                    .order_by('pk')
                    .values_list('pk', 'request_author_id', 'attachment_id')[
                        : options['chunk_size']
                    ]
                )
                if not chunk:
                    break

                attachment_ids_per_user = defaultdict(list)
                for _, user_id, attachment_id in chunk:
                    attachment_ids_per_user[user_id].append(attachment_id)

                for user_id, attachment_ids in attachment_ids_per_user.items():
                    if user_id not in cutoffs:
                        cutoffs[user_id] = self._get_auto_deletion_cutoff(
                            user_id, since
                        )
                    restored, kept = self._restore_chunk(
                        users[user_id], attachment_ids, author, cutoffs[user_id]
                    )
                    user_stats = stats.setdefault(user_id, [0, 0, 0])
                    user_stats[0] += restored
                    user_stats[1] += kept
                    user_stats[2] += len(attachment_ids) - restored - kept

                last_pk = chunk[-1][0]
                cache.set(position_key, last_pk, POSITION_TTL)
                # Keep the lock alive while the run makes progress
                cache.touch(LOCK_KEY, LOCK_TTL)

                idx += 1
                if options['verbosity'] > 1 or idx % PROGRESS_EVERY == 0:
                    self.stdout.write(
                        f'Trash entries: {sum(s[0] for s in stats.values())} '
                        f'restored so far, up to entry #{last_pk}'
                    )
        finally:
            # Periodic tasks are deleted without signals (see `_restore_chunk()`),
            # so Celery Beat is told once here that its schedule changed
            PeriodicTasks.update_changed()

        restored_user_ids = set()
        for user_id, (restored, kept, skipped) in stats.items():
            if restored:
                restored_user_ids.add(user_id)
                # Usage is cached, the user would still see their old storage
                ServiceUsageCalculator(users[user_id]).clear_cache()
            self.stdout.write(
                f'User #{user_id} `{users[user_id].username}`: {restored} '
                f'restored, {kept} kept (trashed by the owner), {skipped} skipped'
            )

        self.stdout.write(
            f'Restored {sum(s[0] for s in stats.values())} attachment(s) for '
            f'{len(restored_user_ids)} user(s), '
            f'kept {sum(s[1] for s in stats.values())}, '
            f'skipped {sum(s[2] for s in stats.values())}'
        )
        return restored_user_ids

    def _get_auto_deletion_cutoff(
        self, user_id: int, since: datetime
    ) -> datetime | None:
        """
        Return the creation date of the oldest attachment of `user_id` that
        auto-deletion left active, or None if there is none

        `auto_delete_excess_attachments` trashes the oldest active attachments
        first. Everything it trashed is therefore not newer than this date. An
        attachment trashed in the window but newer than this date was trashed
        by the owner, and must stay in trash.

        Attachments modified since `since` are ignored: they were restored by
        an earlier run of this command, or created or changed after the
        outage. Without that, a run stopped in the middle of a user would
        move the date back and keep the remaining attachments in trash. When
        in doubt, the date can only move forward, i.e. towards restoring more.
        """
        return (
            Attachment.objects.filter(user_id=user_id, date_modified__lt=since)
            .order_by('date_created')
            .values_list('date_created', flat=True)
            .first()
        )

    def _restore_chunk(
        self,
        user: User,
        attachment_ids: list[int],
        author: User,
        cutoff: datetime | None,
    ) -> tuple[int, int]:
        """
        Restore one chunk of attachments. Return how many were restored, and
        how many were kept in trash because the owner trashed them (see
        `_get_auto_deletion_cutoff()`).

        It does the same job as `put_back()` (the function behind the admin
        "Put back" action), but does not call it, for two reasons:

        1. `put_back()` updates the row Celery Beat watches every time it is
           called, i.e. thousands of times here. That is the lock which brought
           the server down. Here, it is updated once, at the end of the run.
        2. `put_back()` raises an error for the whole chunk if one attachment
           is being deleted at that moment. Here, only that attachment is
           skipped.

        Attachments live in the kobocat database, their trash entries in the
        KPI one, so one transaction cannot cover both. `toggle_statuses()`
        commits on kobocat before Mongo is updated and the KPI transaction
        commits. If one of these last two steps fails, the attachment is
        active again but its trash entry, and the task that hard-deletes it,
        are still there. The command stops with an error: run it again, it
        finishes these attachments (see the `delete_status IS NULL` case
        below). Do not leave it like that, the files would be deleted for good
        when the trash retention expires.
        """
        # `auto_delete_excess_attachments` always acts as the owner. Entries
        # trashed by someone else (e.g. a collaborator) are left untouched.
        # Attachments already active come from an earlier run stopped between
        # the kobocat and KPI commits, only their trash entry is left to remove
        attachments = list(
            Attachment.all_objects.filter(
                Q(delete_status=AttachmentDeleteStatus.PENDING_DELETE)
                | Q(delete_status__isnull=True),
                pk__in=attachment_ids,
                user_id=user.pk,
            ).values(
                'pk',
                'uid',
                'media_file_basename',
                'instance_id',
                'delete_status',
                'date_created',
            )
        )
        kept = 0
        if cutoff is not None:
            kept = sum(1 for att in attachments if att['date_created'] > cutoff)
            attachments = [att for att in attachments if att['date_created'] <= cutoff]

        if not attachments:
            return 0, kept

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
                return 0, kept

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

            # Clears `delete_status` and adds the storage back to the user and
            # project counters. Commits on kobocat right away, see the
            # docstring above
            if uids := [
                att['uid']
                for att in attachments
                if att['delete_status'] == AttachmentDeleteStatus.PENDING_DELETE
            ]:
                AttachmentTrash.toggle_statuses(uids, active=True)

            # Update the `is_deleted` flag in Mongo, so the attachments show up
            # again in the data table and exports. Done before the KPI commit,
            # so if Mongo fails, the trash entries are kept for the next run
            ParsedInstance.bulk_update_attachments(
                list({att['instance_id'] for att in attachments})
            )

        return len(attachments), kept

    def _iter_orphan_chunks(
        self,
        options: dict,
        since: datetime,
        until: datetime,
        last_position: tuple[datetime, int] | None = None,
    ):
        """
        Yield, chunk after chunk, the attachments left `pending-delete` within
        the window without any trash entry (orphans), and how many attachments
        of the chunk were skipped because they have one

        Orphans come from `move_to_trash()` killed half-way: the attachments
        were marked `pending-delete` (and their storage subtracted) on
        kobocat, but the trash entries were never created on KPI.

        `toggle_statuses()` gives the same `date_modified` to every attachment
        of a call, i.e. up to tens of thousands of rows share it. The chunks
        are therefore read with `(date_modified, id) > (last date_modified,
        last id)`, which needs this temporary index on kobocat to stay fast:

            CREATE INDEX CONCURRENTLY tmp_logger_attachment_pending_delete_dm_id
                ON logger_attachment (date_modified, id)
                WHERE delete_status = 'pending-delete';

        The position always moves forward, even when nothing is restored in a
        chunk, and restored attachments leave the index, so a new run only
        reads what is left.
        """
        user_ids = set(options['user_ids'])
        excluded_user_ids = set(options['excluded_user_ids'])
        table = Attachment._meta.db_table
        while True:
            queryset = Attachment.all_objects.filter(
                delete_status=AttachmentDeleteStatus.PENDING_DELETE,
                date_modified__gte=since,
                date_modified__lt=until,
            )
            if user_ids:
                # A few users only: read their attachments through the
                # `user_id` index instead of the whole window
                queryset = queryset.filter(user_id__in=user_ids)
            if last_position:
                queryset = queryset.filter(
                    RawSQL(
                        f'("{table}"."date_modified", "{table}"."id") > (%s, %s)',
                        last_position,
                        output_field=BooleanField(),
                    )
                )
            attachments = list(
                queryset.order_by('date_modified', 'pk').values(
                    'pk',
                    'uid',
                    'user_id',
                    'instance_id',
                    'date_created',
                    'date_modified',
                )[: options['chunk_size']]
            )
            if not attachments:
                return

            last_position = (attachments[-1]['date_modified'], attachments[-1]['pk'])

            # Excluded users are filtered here rather than in SQL, so that the
            # query keeps reading the index in order
            attachments = [
                att
                for att in attachments
                if (not user_ids or att['user_id'] in user_ids)
                and att['user_id'] not in excluded_user_ids
            ]
            # Handled by the trash loop, or trashed by a person: not orphans
            with_trash = set(
                AttachmentTrash.objects.filter(
                    attachment_id__in=[att['pk'] for att in attachments]
                ).values_list('attachment_id', flat=True)
            )
            yield (
                [att for att in attachments if att['pk'] not in with_trash],
                len(with_trash),
                last_position,
            )

    def _report_orphans(self, options: dict, since: datetime, until: datetime):
        """
        Print how many orphan attachments a real run would restore (see
        `_iter_orphan_chunks()`)
        """
        total = 0
        total_with_trash = 0
        counts_per_user = {}
        for idx, (orphans, with_trash, last_position) in enumerate(
            self._iter_orphan_chunks(options, since, until), start=1
        ):
            total += len(orphans)
            total_with_trash += with_trash
            for att in orphans:
                counts_per_user[att['user_id']] = (
                    counts_per_user.get(att['user_id'], 0) + 1
                )
            if idx % PROGRESS_EVERY == 0:
                self.stdout.write(
                    f'[DRY RUN] Orphans: {total} found so far, up to '
                    f'{last_position[0].isoformat()}'
                )

        self.stdout.write(
            f'[DRY RUN] {total} orphan attachment(s) (pending-delete without '
            f'trash entry) for {len(counts_per_user)} user(s), '
            f'{total_with_trash} pending-delete attachment(s) with a trash entry '
            f'left to the trash loop'
        )
        if options['verbosity'] > 1:
            for user_id, count in sorted(counts_per_user.items()):
                self.stdout.write(f'  User #{user_id}: {count} orphan(s)')

    def _restore_orphan_chunk(self, attachments: list[dict]) -> int:
        """
        Restore orphan attachments (see `_iter_orphan_chunks()`) and return how
        many were restored

        No trash entry, periodic task or audit log to deal with: none was ever
        created. `toggle_statuses()` only changes the attachments still
        `pending-delete` and adds their storage back, in the same kobocat
        transaction, so the storage counters stay right if the run stops.
        """
        _, restored = AttachmentTrash.toggle_statuses(
            [att['uid'] for att in attachments], active=True
        )
        instance_ids = sorted({att['instance_id'] for att in attachments})
        try:
            ParsedInstance.bulk_update_attachments(instance_ids)
        except Exception:
            # The attachments are active again, a new run would not find them.
            # Give what is needed to update Mongo by hand
            self.stderr.write(
                f'Mongo update failed, run it again from a shell:\n'
                f'ParsedInstance.bulk_update_attachments({instance_ids})'
            )
            raise
        return restored

    def _restore_orphans(
        self, options: dict, since: datetime, until: datetime
    ) -> set[int]:
        """
        Restore every orphan attachment of the window (see
        `_iter_orphan_chunks()`), and return the IDs of the users who got at
        least one back

        The same rule as for trash entries applies: orphans newer than the
        oldest attachment the owner still has were trashed by a person, and
        stay `pending-delete`.
        """
        cutoffs = {}
        restored_user_ids = set()
        total_restored = 0
        total_kept = 0
        total_with_trash = 0
        position_key = self._get_position_key('orphans', options)
        start_position = self._get_saved_position(position_key, options)
        for idx, (orphans, with_trash, last_position) in enumerate(
            self._iter_orphan_chunks(options, since, until, start_position),
            start=1,
        ):
            total_with_trash += with_trash
            to_restore = []
            for att in orphans:
                user_id = att['user_id']
                if user_id not in cutoffs:
                    cutoffs[user_id] = self._get_auto_deletion_cutoff(user_id, since)
                cutoff = cutoffs[user_id]
                if cutoff is not None and att['date_created'] > cutoff:
                    total_kept += 1
                else:
                    to_restore.append(att)

            if to_restore:
                total_restored += self._restore_orphan_chunk(to_restore)
                restored_user_ids.update(att['user_id'] for att in to_restore)

            cache.set(position_key, last_position, POSITION_TTL)
            # Keep the lock alive while the run makes progress
            cache.touch(LOCK_KEY, LOCK_TTL)

            if options['verbosity'] > 1 or idx % PROGRESS_EVERY == 0:
                self.stdout.write(
                    f'Orphans: {total_restored} restored, {total_kept} kept so '
                    f'far, up to {last_position[0].isoformat()}'
                )

        # Usage is cached, the users would still see their old storage
        for user in User.objects.filter(pk__in=restored_user_ids).iterator():
            ServiceUsageCalculator(user).clear_cache()

        self.stdout.write(
            f'Restored {total_restored} orphan attachment(s) for '
            f'{len(restored_user_ids)} user(s), kept {total_kept} (newer than '
            f'the oldest attachment the owner still has), {total_with_trash} '
            f'with a trash entry left untouched'
        )
        return restored_user_ids

    def _get_position_key(self, loop: str, options: dict) -> str:
        """
        Return the cache key of the position reached by `loop` for a run with
        these options. Runs with other options (window, users) do not share it
        """
        return ':'.join(
            [
                LOCK_KEY,
                'position',
                loop,
                options['since'],
                options['until'],
                ','.join(map(str, sorted(options['user_ids']))),
                ','.join(map(str, sorted(options['excluded_user_ids']))),
            ]
        )

    def _get_saved_position(self, position_key: str, options: dict):
        """
        Return the position saved by an interrupted run, or None to start from
        the beginning

        Everything before it was already processed: restored, or left in place
        on purpose (kept, skipped). Nothing new can appear before it, since
        auto-deletion is disabled. Starting from the beginning is always
        correct too, only slower.
        """
        if options['from_start']:
            cache.delete(position_key)
            return None

        position = cache.get(position_key)
        if position:
            self.stdout.write(f'Resuming from the saved position {position}')
        return position

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

    def _get_days_since_enforcement(self, since: datetime) -> int:
        """
        Return the number of days the storage counters are reset to: the days
        elapsed since `since`, the day enforcement was enabled. Counted on
        dates, like `check_exceeded_limit()` does, e.g. 1 the day after
        """
        return (timezone.now().date() - since.date()).days

    def _report_storage_counters(self, user_ids: list[int], since: datetime):
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
            f'Storage counters to reset to '
            f'{self._get_days_since_enforcement(since)} day(s): {counters.count()} '
            f'({counters.filter(days__gte=retention).count()} at {retention} '
            f'days or more)'
        )

    def _reset_storage_counters(
        self, user_ids: list[int], restored_user_ids: list[int], since: datetime
    ):
        """
        Restart the countdown before auto-deletion from the day enforcement was
        enabled: set the storage counters to the days elapsed since `since`,
        and give one back to restored users who lost it
        """
        if not settings.STRIPE_ENABLED:
            return

        days = self._get_days_since_enforcement(since)

        # Every storage counter is reset, not only those of the restored
        # users, as agreed with product: the counters kept counting while
        # enforcement was off, so no user was ever told when auto-deletion
        # would start. The countdown restarts for everyone from the day
        # enforcement was enabled.
        # `update()` skips `auto_now`, `date_modified` is set explicitly so the
        # next daily increment happens 24 hours from now
        reset_count = self._get_storage_counters(user_ids).update(
            days=days, date_modified=timezone.now()
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
                    user_id=user_id, limit_type=UsageType.STORAGE_BYTES, days=days
                )
                for user_id in restored_user_ids
                if user_id not in existing_user_ids
            ]
        )
        self.stdout.write(
            f'Reset {reset_count} storage counter(s) to {days} day(s), '
            f'created {len(created)}'
        )

    def _parse_datetime(self, value: str, option: str):
        """
        Convert the text given to `--since` or `--until` into a UTC datetime,
        e.g. `2026-09-30T19:00:00`. Without a timezone, UTC is assumed
        """
        parsed = parse_datetime(value)
        if parsed is None:
            raise CommandError(f'`{option}` is not a valid ISO 8601 datetime')
        if timezone.is_naive(parsed):
            parsed = parsed.replace(tzinfo=dt_timezone.utc)
        # Always work in UTC, so that dates taken from it (e.g. by
        # `_get_days_since_enforcement()`) do not depend on the offset typed
        return parsed.astimezone(dt_timezone.utc)
