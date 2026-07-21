# flake8: noqa: E501
import csv
import io
import os

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError, OutputWrapper

from kobo.apps.openrosa.apps.logger.models.attachment import Attachment
from kobo.apps.openrosa.apps.main.models import MetaData
from kobo.apps.project_ownership.models import (
    Transfer,
    TransferStatusChoices,
    TransferStatusTypeChoices,
)
from kobo.apps.project_ownership.models.invite import Invite
from kobo.apps.project_ownership.utils import get_target_folder
from kpi.deployment_backends.kc_access.storage import default_kobocat_storage
from kpi.exceptions import InvalidXFormException, MissingXFormException
from kpi.models.asset import AssetFile

# Written by TransferStatus.update_status() when a previously successful task
# is downgraded by a concurrent retry. Used to identify false failures.
_FALSE_FAILURE_MARKER = 'Updating status of previously successful transfer to'


class Command(BaseCommand):
    help = (
        'Validate (and optionally fix) a member-to-org ownership transfer.'
        ' Without --fix, runs as a dry-run: reports what would be changed.'
        ' Usage: ./manage.py validate_org_transfer <invite_uid_or_pk> [--fix] [--csv PATH]'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            'invite',
            type=str,
            help='UID (poi...) or PK of the invite to validate.',
        )
        parser.add_argument(
            '--fix',
            action='store_true',
            default=False,
            help=(
                'Apply safe DB-only fixes: patch attachment records whose S3 file '
                'was moved but save() was never called, and reset TransferStatus '
                'rows that were falsely downgraded by a concurrent retry.'
            ),
        )
        parser.add_argument(
            '--errors-only',
            action='store_true',
            default=False,
            help='Only show transfers that have at least one issue.',
        )
        parser.add_argument(
            '--csv',
            dest='csv_path',
            type=str,
            default=None,
            help='Write results to a CSV file at this path (e.g. /tmp/report.csv).',
        )

    def handle(self, *args, **options):
        invite_arg = options['invite']
        dry_run = not options['fix']
        errors_only = options['errors_only']
        csv_path = options.get('csv_path')

        try:
            if invite_arg.startswith('poi'):
                invite = Invite.all_objects.select_related('sender', 'recipient').get(
                    uid=invite_arg
                )
            else:
                invite = Invite.all_objects.select_related('sender', 'recipient').get(
                    pk=int(invite_arg)
                )
        except Invite.DoesNotExist:
            raise CommandError(f'Invite "{invite_arg}" not found.')
        except ValueError:
            raise CommandError(
                f'"{invite_arg}" is not a valid invite UID (poi...) or integer PK.'
            )

        old_username = invite.sender.username
        new_username = invite.recipient.username
        new_user = invite.recipient

        mode = (
            'DRY RUN — no changes will be written'
            if dry_run
            else 'FIX MODE — DB changes will be applied'
        )
        self.stdout.write(
            f'Invite {invite.uid} (pk={invite.pk}): '
            f'{old_username} → {new_username}  [status: {invite.status}]\n'
            f'Mode: {mode}'
        )

        transfers = (
            Transfer.objects.filter(
                invite=invite,
            )
            .select_related('asset', 'invite')
            .prefetch_related('statuses__errors')
        )

        transfer_count = transfers.count()
        if transfer_count == 0:
            self.stdout.write(
                self.style.WARNING(
                    f'No transfers found from "{old_username}" to "{new_username}".'
                )
            )
            return

        self.stdout.write(
            f'\nValidating {transfer_count} transfer(s) '
            f'from "{old_username}" to "{new_username}"\n' + '=' * 70
        )

        summary = {'ok': 0, 'false_failure': 0, 'real_failure': 0, 'unexpected': 0}
        csv_rows = []

        for transfer in transfers.iterator():
            # Buffer output for this transfer so we can suppress it when
            # --errors-only is set and the transfer has no issues.
            buf = io.StringIO()
            real_stdout = self.stdout
            self.stdout = OutputWrapper(buf)
            try:
                result, rows = self._validate_transfer(
                    transfer, old_username, new_username, new_user, dry_run
                )
            finally:
                self.stdout = real_stdout

            if not errors_only or result != 'ok':
                self.stdout.write(buf.getvalue(), ending='')

            summary[result] += 1
            csv_rows.extend(rows)

        self.stdout.write('\n' + '=' * 70)
        self.stdout.write(
            f'Summary: {summary["ok"]} OK  |  '
            f'{summary["false_failure"]} false failures  |  '
            f'{summary["real_failure"]} real failures  |  '
            f'{summary["unexpected"]} unexpected'
        )
        if dry_run and (summary['false_failure'] > 0):
            self.stdout.write(
                self.style.WARNING(
                    'Re-run with --fix to apply safe DB corrections for false failures.'
                )
            )

        if csv_path:
            self._write_csv(csv_path, csv_rows)
            self.stdout.write(f'\nReport written to: {csv_path}')

    def _validate_transfer(
        self,
        transfer: Transfer,
        old_username: str,
        new_username: str,
        new_user,
        dry_run: bool,
    ) -> tuple[str, list]:
        asset = transfer.asset
        statuses_by_type = {s.status_type: s for s in transfer.statuses.all()}
        rows = []

        self.stdout.write(
            f'\n[Transfer {transfer.uid}] Asset: {asset.uid} — "{asset.name}"'
        )

        def _base_row(check_type, verdict, db_status, data_ok, detail):
            return {
                'transfer_uid': transfer.uid,
                'asset_uid': asset.uid,
                'asset_name': asset.name,
                'check_type': check_type,
                'db_status': db_status,
                'data_ok': data_ok,
                'verdict': verdict,
                'detail': detail,
            }

        # --- Asset owner ---
        if asset.owner.username != new_username:
            self.stdout.write(
                self.style.ERROR(
                    f'  Asset owner is "{asset.owner.username}", expected "{new_username}"'
                )
            )
            rows.append(
                _base_row(
                    'asset_owner',
                    'real_failure',
                    'n/a',
                    False,
                    f'owner is {asset.owner.username}',
                )
            )
            return 'real_failure', rows

        self.stdout.write(
            self.style.SUCCESS(f'  Asset owner: {asset.owner.username} ✓')
        )

        if not asset.has_deployment:
            self.stdout.write('  (No deployment — draft project, skipping checks)')
            rows.append(_base_row('asset_owner', 'ok', 'n/a', True, 'draft project'))
            return 'ok', rows

        # --- XForm owner ---
        try:
            xform = asset.deployment.xform
        except (InvalidXFormException, MissingXFormException) as e:
            self.stdout.write(self.style.ERROR(f'  XForm not found: {e}'))
            rows.append(_base_row('xform_owner', 'real_failure', 'n/a', False, str(e)))
            return 'real_failure', rows

        if xform.user.username != new_username:
            self.stdout.write(
                self.style.ERROR(
                    f'  XForm owner is "{xform.user.username}", expected "{new_username}"'
                )
            )
            rows.append(
                _base_row(
                    'xform_owner',
                    'real_failure',
                    'n/a',
                    False,
                    f'xform owner is {xform.user.username}',
                )
            )
            return 'real_failure', rows

        overall = 'ok'

        # --- Submissions (_userform_id in MongoDB) ---
        ts = statuses_by_type.get(TransferStatusTypeChoices.SUBMISSIONS)
        mongo_ok, mongo_detail = self._check_mongo(asset, old_username, xform)
        result, meta = self._verdict(
            ts, mongo_ok, 'Submissions (_userform_id)', mongo_detail, dry_run
        )
        rows.append(
            _base_row('submissions', result, meta['db_status'], mongo_ok, mongo_detail)
        )
        if result != 'ok':
            overall = result

        # --- Attachments ---
        ts = statuses_by_type.get(TransferStatusTypeChoices.ATTACHMENTS)
        att_ok, att_detail = self._check_attachments(
            asset, new_username, new_user, dry_run
        )
        result, meta = self._verdict(ts, att_ok, 'Attachments', att_detail, dry_run)
        rows.append(
            _base_row('attachments', result, meta['db_status'], att_ok, att_detail)
        )
        if result != 'ok':
            overall = result

        # --- AssetFiles + MetaData ---
        ts = statuses_by_type.get(TransferStatusTypeChoices.MEDIA_FILES)
        mf_ok, mf_detail = self._check_media_files(asset, xform, new_username)
        result, meta = self._verdict(ts, mf_ok, 'Media files', mf_detail, dry_run)
        rows.append(
            _base_row('media_files', result, meta['db_status'], mf_ok, mf_detail)
        )
        if result != 'ok':
            overall = result

        return overall, rows

    def _verdict(
        self, ts, data_ok: bool, label: str, detail: str, dry_run: bool
    ) -> tuple[str, dict]:
        """
        Cross-reference the recorded TransferStatus against the observed data state,
        emit a colour-coded verdict line, and reset false-failure statuses when
        dry_run=False.

        Returns (verdict, {'db_status': ...}).
        """
        if ts is None:
            db_status = 'missing'
            error_texts = []
            is_false_failure = False
        else:
            db_status = ts.status
            error_texts = list(ts.errors.values_list('error', flat=True))
            is_false_failure = db_status == TransferStatusChoices.FAILED and any(
                _FALSE_FAILURE_MARKER in (e or '') for e in error_texts
            )

        meta = {'db_status': db_status}

        if data_ok and db_status == TransferStatusChoices.SUCCESS:
            spurious_errors = (
                [e for e in error_texts if _FALSE_FAILURE_MARKER in (e or '')]
                if ts is not None
                else []
            )
            if spurious_errors:
                prefix = '[DRY RUN] Would delete' if dry_run else 'Deleting'
                self.stdout.write(
                    self.style.WARNING(
                        f'  [{label}] OK (data ✓, status=success) but has '
                        f'{len(spurious_errors)} spurious error record(s) from retry.\n'
                        f'    → {prefix} spurious errors'
                        + ('' if not dry_run else ' (use --fix to apply)')
                    )
                )
                if not dry_run and ts is not None:
                    ts.errors.filter(error__contains=_FALSE_FAILURE_MARKER).delete()
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'    ✓ {len(spurious_errors)} spurious error record(s) deleted'
                        )
                    )
            else:
                self.stdout.write(
                    self.style.SUCCESS(f'  [{label}] OK — data ✓, status=success')
                )
            return 'ok', meta

        if data_ok and (is_false_failure or db_status == TransferStatusChoices.FAILED):
            prefix = '[DRY RUN] Would reset' if dry_run else 'Resetting'
            reason = (
                'concurrent retry downgraded an already-successful task'
                if is_false_failure
                else 'data is correct'
            )
            self.stdout.write(
                self.style.WARNING(
                    f'  [{label}] FALSE FAILURE — data ✓ but status=failed ({reason}). '
                    f'{detail}\n'
                    f'    → {prefix} TransferStatus to success'
                    + ('' if not dry_run else ' (use --fix to apply)')
                )
            )
            if not dry_run and ts is not None:
                error_count = ts.errors.count()
                ts.errors.all().delete()
                ts.status = TransferStatusChoices.SUCCESS
                ts.save(update_fields=['status'])
                # Propagate to global Transfer status + Invite status
                ts.update_transfer_status()
                self.stdout.write(
                    self.style.SUCCESS(
                        f'    ✓ TransferStatus reset to success'
                        + (
                            f', {error_count} error record(s) deleted'
                            if error_count
                            else ''
                        )
                    )
                )
            return 'false_failure', meta

        if data_ok and db_status in (
            TransferStatusChoices.PENDING,
            TransferStatusChoices.IN_PROGRESS,
        ):
            self.stdout.write(
                self.style.SUCCESS(
                    f'  [{label}] DATA OK — status={db_status} (data looks fine). {detail}'
                )
            )
            return 'ok', meta

        if not data_ok and db_status == TransferStatusChoices.SUCCESS:
            self.stdout.write(
                self.style.ERROR(
                    f'  [{label}] UNEXPECTED — status=success but data check FAILED. {detail}'
                )
            )
            return 'unexpected', meta

        if not data_ok:
            self.stdout.write(
                self.style.ERROR(
                    f'  [{label}] REAL FAILURE — data check failed, status={db_status}. {detail}'
                )
            )
            return 'real_failure', meta

        self.stdout.write(
            self.style.WARNING(
                f'  [{label}] INCOMPLETE — status={db_status}, data not yet correct. {detail}'
            )
        )
        return 'real_failure', meta

    def _write_csv(self, path: str, rows: list[dict]):
        fieldnames = [
            'transfer_uid',
            'asset_uid',
            'asset_name',
            'check_type',
            'db_status',
            'data_ok',
            'verdict',
            'detail',
        ]
        try:
            with open(path, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)
        except OSError as e:
            self.stderr.write(self.style.ERROR(f'Could not write CSV: {e}'))

    # ------------------------------------------------------------------
    # Data checks — return (ok: bool, detail: str)
    # ------------------------------------------------------------------

    def _check_mongo(self, asset, old_username: str, xform) -> tuple[bool, str]:
        mongo_userform_id = asset.deployment.mongo_userform_id
        backend_response = asset.deployment.backend_response
        previous_id_string = backend_response.get('previous_id_string')

        old_patterns = [f'{old_username}_{xform.id_string}']
        if previous_id_string:
            old_patterns.append(f'{old_username}_{previous_id_string}')

        stale = 0
        stale_details = []
        for pattern in old_patterns:
            count = settings.MONGO_DB.instances.count_documents(
                {'_userform_id': pattern}
            )
            if count > 0:
                stale += count
                stale_details.append(f'{count} docs with _userform_id="{pattern}"')

        if stale > 0:
            return False, f'Stale MongoDB docs: {"; ".join(stale_details)}'

        current = settings.MONGO_DB.instances.count_documents(
            {'_userform_id': mongo_userform_id}
        )
        return True, f'{current} doc(s) under new _userform_id="{mongo_userform_id}"'

    def _check_attachments(
        self, asset, new_username: str, new_user, dry_run: bool
    ) -> tuple[bool, str]:
        submissions = asset.deployment.get_submissions(asset.owner, fields=['_id'])
        submission_ids = [s['_id'] for s in submissions]

        if not submission_ids:
            return True, 'no submissions'

        total = Attachment.all_objects.filter(instance_id__in=submission_ids).count()

        misplaced = Attachment.all_objects.filter(
            instance_id__in=submission_ids
        ).exclude(media_file__startswith=f'{new_username}/')

        wrong_user = (
            Attachment.all_objects.filter(instance_id__in=submission_ids)
            .exclude(user__username=new_username)
            .count()
        )

        # For each misplaced attachment (media_file path still under old owner),
        # probe S3 to distinguish three situations:
        #
        # 1. not_moved    — file still at old S3 path. Retry will fix this.
        #
        # 2. db_not_saved — file gone from old path, exists at expected new path.
        #                   S3 move succeeded but attachment.save() was never
        #                   called (process killed between move and DB write).
        #                   Files are safe; DB record needs patching.
        #
        # 3. missing_s3   — file absent from both paths. Genuinely lost.
        not_moved = 0
        db_not_saved_pks = []  # collect PKs so we can patch them
        missing_s3 = 0

        for att in misplaced.only('pk', 'media_file').iterator():
            old_path = att.media_file.name
            if not old_path:
                missing_s3 += 1
                continue
            path_owner = old_path.split('/')[0]
            new_path_dir = get_target_folder(path_owner, new_username, old_path)
            new_path = (
                os.path.join(new_path_dir, os.path.basename(old_path))
                if new_path_dir
                else None
            )

            if default_kobocat_storage.exists(old_path):
                not_moved += 1
            elif new_path and default_kobocat_storage.exists(new_path):
                db_not_saved_pks.append((att.pk, new_path))
            else:
                missing_s3 += 1

        db_not_saved = len(db_not_saved_pks)
        parts = [f'{total} total attachments']

        if not_moved:
            parts.append(
                f'{not_moved} not yet moved (file at old S3 path — retry will fix)'
            )

        if db_not_saved:
            prefix = '[DRY RUN] Would patch' if dry_run else 'Patching'
            parts.append(
                f'{db_not_saved} moved in S3 but attachment.save() never called'
                f' (file safe at new path, DB needs patching)'
                + ('' if not dry_run else ' — use --fix to apply')
            )
            self.stdout.write(
                self.style.WARNING(
                    f'    → {prefix} {db_not_saved} attachment record(s): '
                    f'media_file path + user_id'
                )
            )
            if not dry_run:
                self._fix_db_not_saved_attachments(db_not_saved_pks, new_user)

        if missing_s3:
            # A file that no longer exists cannot be "moved" — this is not a
            # transfer failure (data was already gone). Report it, but it does
            # not fail the check. Matches ExtendedFieldFile.move() /
            # move_attachments treating a missing source as a skip.
            parts.append(
                f'{missing_s3} missing from S3 on both paths — OK (data already gone)'
            )
        if wrong_user:
            parts.append(f'{wrong_user} still owned by wrong user (FK not updated)')

        real_issues = not_moved
        ok = real_issues == 0 and wrong_user == 0
        return ok, ', '.join(parts)

    def _fix_db_not_saved_attachments(self, pks_and_paths: list, new_user):
        """
        For attachments whose S3 file was already moved but save() was never
        called, update media_file to the new path and user_id to the new owner.
        """
        fixed = 0
        for pk, new_path in pks_and_paths:
            try:
                att = Attachment.all_objects.get(pk=pk)
                att.media_file.name = new_path
                att.user_id = new_user.pk
                att.save(update_fields=['media_file', 'user_id'])
                fixed += 1
            except Exception as e:
                self.stderr.write(
                    self.style.ERROR(f'    ✗ Failed to patch attachment #{pk}: {e}')
                )
        if fixed:
            self.stdout.write(
                self.style.SUCCESS(f'    ✓ Patched {fixed} attachment record(s)')
            )

    def _check_media_files(self, asset, xform, new_username: str) -> tuple[bool, str]:
        media_files = asset.asset_files.filter(file_type=AssetFile.FORM_MEDIA)
        total_mf = media_files.count()

        # Exclude empty content (URL-based or not yet uploaded files have no
        # local path to migrate).
        wrong_mf_qs = media_files.exclude(content='').exclude(
            content__startswith=f'{new_username}/'
        )
        wrong_mf = wrong_mf_qs.count()
        wrong_mf_paths = list(wrong_mf_qs.values_list('content', flat=True)[:10])

        kc_files = MetaData.objects.filter(xform_id=xform.pk)
        total_kc = kc_files.count()

        # MetaData rows with empty data_file are URL-based, no path to migrate.
        wrong_kc_qs = kc_files.exclude(data_file='').exclude(
            data_file__startswith=f'{new_username}/'
        )
        wrong_kc = wrong_kc_qs.count()
        wrong_kc_paths = list(wrong_kc_qs.values_list('data_file', flat=True)[:10])

        parts = []
        if total_mf:
            parts.append(f'AssetFiles: {total_mf - wrong_mf}/{total_mf} migrated')
            if wrong_mf_paths:
                parts.append(f'still at old path: {wrong_mf_paths}')
        else:
            parts.append('AssetFiles: none')

        if total_kc:
            parts.append(f'MetaData: {total_kc - wrong_kc}/{total_kc} migrated')
            if wrong_kc_paths:
                parts.append(f'still at old path: {wrong_kc_paths}')
        else:
            parts.append('MetaData: none')

        ok = wrong_mf == 0 and wrong_kc == 0
        return ok, ', '.join(parts)
