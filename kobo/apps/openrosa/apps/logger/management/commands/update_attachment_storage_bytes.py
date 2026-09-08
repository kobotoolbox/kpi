from __future__ import annotations

from collections.abc import Callable

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db.models import OuterRef, Subquery, Sum, Value
from django.db.models.functions import Coalesce

from kobo.apps.openrosa.apps.logger.models.attachment import Attachment
from kobo.apps.openrosa.apps.logger.models.xform import XForm
from kobo.apps.openrosa.apps.logger.utils.suspension import (
    release_orphaned_suspensions,
    suspend_submissions,
)
from kobo.apps.openrosa.apps.main.models.user_profile import UserProfile
from kpi.utils.django_orm_helper import UpdateJSONFieldAttributes


class Command(BaseCommand):

    help = (
        'Retroactively calculate the total attachment file storage '
        'per xform and user profile'
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._verbosity = 0
        self._force = False
        self._sync = False

    def add_arguments(self, parser):
        parser.add_argument(
            '--chunks',
            type=int,
            default=2000,
            help='Number of records to process per query',
        )

        parser.add_argument(
            '-f', '--force',
            action='store_true',
            default=False,
            help='Recalculate counters for every user. Default is False',
        )

        parser.add_argument(
            '-s', '--sync',
            action='store_true',
            default=False,
            help='Update only out of sync counters. Default is False',
        )

        parser.add_argument(
            '-u', '--username',
            type=str,
            help='Run the command for a specific user',
        )

        parser.add_argument(
            '-nl', '--no-lock',
            action='store_true',
            default=False,
            help=(
                'Do not lock accounts from receiving submissions while updating '
                'storage counters.\n'
                'WARNING: This may result in discrepancies. The default value is False.'
            )
        )

    def handle(self, *args, **kwargs):

        self._verbosity = kwargs['verbosity']
        self._force = kwargs['force']
        self._sync = kwargs['sync']
        chunks = kwargs['chunks']
        username = kwargs['username']
        no_lock = kwargs['no_lock']

        if self._force and self._sync:
            self.stderr.write(
                '`force` and `sync` options cannot be used together'
            )
            return

        if username and self._sync:
            self.stderr.write(
                '`username` and `sync` options cannot be used together'
            )
            return

        if self._sync and self._verbosity >= 1:
            self.stdout.write(
                '`sync` option has been enabled'
            )

        if self._force and self._verbosity >= 1:
            self.stdout.write(
                '`force` option has been enabled'
            )

        if not no_lock:
            self._release_locks()

        profile_queryset = self._reset_user_profile_counters()

        user_queryset = self._get_queryset(profile_queryset, username)

        for user in user_queryset.iterator(chunk_size=chunks):

            # Retrieve all user's xforms (even the soft-deleted ones)
            user_xforms = (
                XForm.all_objects.filter(user_id=user.pk)
                .values('pk', 'attachment_storage_bytes')
                .order_by('id')
            )

            if not user_xforms.count():
                if self._verbosity > 2:
                    self.stdout.write(
                        f'Skip user {user.username}. No projects found!'
                    )
                continue

            if no_lock:
                self._update_user_storage(user, user_xforms, chunks)
                continue

            self._mark_counting_started(user)
            with suspend_submissions(user) as heartbeat:
                self._update_user_storage(user, user_xforms, chunks, heartbeat)

        if self._verbosity >= 1:
            self.stdout.write('Done!')

    def _get_queryset(self, profile_queryset, username):
        # Get all profiles already updated to exclude their forms from the list.
        # It is a lazy query and will be `xforms` queryset.

        users = get_user_model().objects.exclude(pk=settings.ANONYMOUS_USER_ID)
        if not self._force and not self._sync:
            subquery = UserProfile.objects.values_list('user_id', flat=True).filter(
                metadata__attachments_counting_status='complete'
            )
            users = users.using(settings.OPENROSA_DB_ALIAS).exclude(pk__in=subquery)

        if self._sync:
            subquery = list(profile_queryset.values_list('user_id', flat=True))
            users = users.filter(pk__in=subquery)

        if username:
            users = users.filter(username=username)

        return users.order_by('pk')

    def _mark_counting_started(self, user: settings.AUTH_USER_MODEL):
        user_profile, _ = UserProfile.objects.get_or_create(user_id=user.pk)
        # Some old profiles don't have metadata
        if user_profile.metadata is None:
            user_profile.metadata = {}
        user_profile.metadata['attachments_counting_status'] = 'not-completed'
        user_profile.save(update_fields=['metadata'])

    def _release_locks(self):
        # Release the profiles a previous run left suspended, without touching
        # the ones held by a running deletion
        if self._verbosity > 1:
            self.stdout.write('Releasing submission locks…')

        orphaned = release_orphaned_suspensions()
        if self._verbosity > 1:
            self.stdout.write(f'Released submission locks: {len(orphaned)}')

    def _reset_user_profile_counters(self):

        # Update all user profile storage counters to zero that do not match
        # sum of all related xform storage counters.
        if self._verbosity > 1:
            self.stdout.write('Resetting user profile storage counters…')

        subquery = Subquery(
            XForm.objects.filter(user_id=OuterRef('user_id'))
            .values('user_id')
            .annotate(total=Sum('attachment_storage_bytes'))
            .values('total')
        )

        profile_query = UserProfile.objects.exclude(
            attachment_storage_bytes=Subquery(subquery)
        )
        update = profile_query.update(attachment_storage_bytes=0)
        if self._verbosity > 1:
            self.stdout.write(f'Updated user profile storage counters: {update}')

        return profile_query

    def _update_user_profile(self, user: settings.AUTH_USER_MODEL):

        if self._verbosity >= 1:
            self.stdout.write(
                f'Updating attachment storage total on '
                f'{user.username}’s profile'
            )

        # Update user's profile
        updates = {
            'attachments_counting_status': 'complete',
        }

        # We cannot use `.aggregate()` in a subquery because it's evaluated
        # right away. See https://stackoverflow.com/a/56122354/1141214 for
        # details.
        subquery = (
            XForm.objects
            .filter(user_id=user.pk)
            .values('user_id')
            .annotate(
                total=Coalesce(Sum('attachment_storage_bytes'), Value(0))
            )
            .values('total')[:1]
        )

        UserProfile.objects.filter(user_id=user.pk).update(
            attachment_storage_bytes=Coalesce(Subquery(subquery), Value(0)),
            metadata=UpdateJSONFieldAttributes(
                'metadata',
                updates=updates,
            ),
        )

    def _update_user_storage(
        self,
        user: settings.AUTH_USER_MODEL,
        user_xforms,
        chunks: int,
        heartbeat: Callable[[], None] = lambda: None,
    ):
        for xform in user_xforms.iterator(chunk_size=chunks):

            heartbeat()

            # write out xform progress
            if self._verbosity > 1:
                self.stdout.write(
                    f'Calculating attachments for xform_id #{xform["pk"]}'
                    f' (user {user.username})'
                )
            # aggregate total media file size for all media per xform
            form_attachments = Attachment.objects.filter(
                instance__xform_id=xform['pk'],
            ).aggregate(total=Sum('media_file_size'))

            if form_attachments['total']:
                if xform['attachment_storage_bytes'] == form_attachments['total']:
                    if self._verbosity > 2:
                        self.stdout.write(
                            '\tSkipping xform update! '
                            'Attachment storage is already accurate'
                        )
                else:
                    if self._verbosity > 2:
                        self.stdout.write(
                            f'\tUpdating xform attachment storage to '
                            f"{form_attachments['total']} bytes"
                        )

                    XForm.all_objects.filter(pk=xform['pk']).update(
                        attachment_storage_bytes=form_attachments['total']
                    )

            else:
                if self._verbosity > 2:
                    self.stdout.write('\tNo attachments found')
                if not xform['attachment_storage_bytes'] == 0:
                    XForm.all_objects.filter(pk=xform['pk']).update(
                        attachment_storage_bytes=0
                    )

        self._update_user_profile(user)
