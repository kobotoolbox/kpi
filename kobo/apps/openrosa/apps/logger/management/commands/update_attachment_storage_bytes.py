from __future__ import annotations

from django.conf import settings
from django.core.cache import cache
from django.core.management.base import BaseCommand, CommandError
from django.db import DatabaseError
from django.template.defaultfilters import filesizeformat

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.constants import (
    RECOUNT_STORAGE_COMMAND_CURSOR_KEY_PREFIX,
)
from kobo.apps.openrosa.apps.logger.models.xform import XForm
from kobo.apps.openrosa.apps.logger.type_aliases import XFormIdBatches
from kobo.apps.openrosa.apps.logger.utils.counters import (
    get_xform_ids_to_recount,
    recount_storage_counter,
)


class Command(BaseCommand):

    help = (
        'Recount the attachment storage counters of projects from the attachments'
        ' they actually hold. By default, recounts the projects whose counter may'
        ' have drifted, like the `recount_drifted_storage_counters` task does.'
        ' Submissions are not suspended: only the drift is added to each counter.'
        ' An interrupted run resumes where it stopped when run again with the'
        ' same options.'
    )

    def add_arguments(self, parser):
        selection = parser.add_mutually_exclusive_group()
        selection.add_argument(
            '-u',
            '--username',
            help='Recount every project of this user',
        )
        selection.add_argument(
            '--all',
            action='store_true',
            default=False,
            help=(
                'Recount every project, e.g. once, to catch drift on projects of'
                ' users inactive for too long to be in the default selection'
            ),
        )
        parser.add_argument(
            '--force',
            action='store_true',
            default=False,
            help='Start over from the first project instead of resuming',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            default=False,
            help='Report the drifts without fixing them',
        )

    def handle(self, *args, **options):
        self._verbosity = options['verbosity']
        self._dry_run = options['dry_run']
        self._stats = {'checked': 0, 'drifted': 0, 'drift': 0, 'failed': 0}

        username = options['username']
        cursor_key = self._get_cursor_key(username, options['all'])
        if options['force']:
            cache.delete(cursor_key)
        if last_xform_id := cache.get(cursor_key, 0):
            self.stdout.write(f'Resuming after xform #{last_xform_id}')

        if username:
            batches = self._get_xform_ids_of_user(username, last_xform_id)
        elif options['all']:
            batches = self._get_xform_ids(XForm.all_objects.all(), last_xform_id)
        else:
            batches = get_xform_ids_to_recount(last_xform_id)

        for batch_last_xform_id, xform_ids in batches:
            for xform_id in xform_ids:
                self._recount(xform_id)
                cache.set(cursor_key, xform_id, timeout=None)
            # Projects of the batch not worth recounting are skipped too
            cache.set(cursor_key, batch_last_xform_id, timeout=None)

        # Every project was checked, the next run starts over
        cache.delete(cursor_key)

        self.stdout.write(
            f'{self._stats["checked"]} projects checked,'
            f' {self._stats["drifted"]} drifted'
            f' for {self._format_size(self._stats["drift"], signed=True)},'
            f' {self._stats["failed"]} failed'
            f'{" (dry run, nothing fixed)" if self._dry_run else ""}'
        )

    def _get_cursor_key(self, username: str | None, all_: bool) -> str:
        if username:
            selection = f'user:{username}'
        elif all_:
            selection = 'all'
        else:
            selection = 'drifted'
        # A dry run must not make a real run skip projects, and vice versa
        mode = 'dry_run' if self._dry_run else 'fix'
        return f'{RECOUNT_STORAGE_COMMAND_CURSOR_KEY_PREFIX}{selection}:{mode}'

    def _format_size(self, size: int, signed: bool = False) -> str:
        sign = '+' if signed and size > 0 else ''
        return f'{sign}{size} ({sign}{filesizeformat(size)})'

    def _get_xform_ids(self, queryset, last_xform_id: int) -> XFormIdBatches:
        while xform_ids := list(
            queryset.filter(pk__gt=last_xform_id)
            .order_by('pk')
            .values_list('pk', flat=True)[: settings.DEFAULT_BATCH_SIZE]
        ):
            last_xform_id = xform_ids[-1]
            yield last_xform_id, xform_ids

    def _get_xform_ids_of_user(
        self, username: str, last_xform_id: int
    ) -> XFormIdBatches:
        try:
            user_id = User.objects.values_list('pk', flat=True).get(username=username)
        except User.DoesNotExist:
            raise CommandError(f'Unknown user: {username}')

        yield from self._get_xform_ids(
            XForm.all_objects.filter(user_id=user_id), last_xform_id
        )

    def _recount(self, xform_id: int):
        try:
            recount = recount_storage_counter(xform_id, dry_run=self._dry_run)
        except DatabaseError as e:
            # E.g. a statement timeout on a huge project: the others still get
            # recounted
            self._stats['failed'] += 1
            self.stderr.write(f'Could not recount xform #{xform_id}: {e}')
            return

        # Deleted meanwhile, or being recounted by the task
        if recount is None:
            return

        self._stats['checked'] += 1
        if not recount.drift:
            return

        self._stats['drifted'] += 1
        self._stats['drift'] += recount.drift
        if self._verbosity:
            self.stdout.write(
                f'XForm #{xform_id} (user #{recount.user_id}):'
                f' counter {self._format_size(recount.counter)},'
                f' real {self._format_size(recount.real)},'
                f' drift {self._format_size(recount.drift, signed=True)}'
            )
