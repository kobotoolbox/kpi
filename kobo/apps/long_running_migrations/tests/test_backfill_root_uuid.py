import importlib
from unittest.mock import MagicMock, patch

from celery.exceptions import SoftTimeLimitExceeded, TimeLimitExceeded
from django.core.management.base import CommandError
from django.db import IntegrityError
from django.test import SimpleTestCase

job_0027 = importlib.import_module(
    'kobo.apps.long_running_migrations.jobs.0027_backfill_remaining_root_uuid'
)
job_0028 = importlib.import_module(
    'kobo.apps.long_running_migrations.jobs.0028_sync_mongo_root_uuid'
)


class BackfillRemainRootUuidTestCase(SimpleTestCase):
    """
    Also covers the Redis-persisted pagination cursor: instances belonging to
    XForms this job permanently skips (pending_delete, or tagged failed)
    never get a `root_uuid`, so a plain in-memory cursor would re-scan past
    them from XForm pk 0 on every Celery restart, potentially never reaching
    a fully empty batch within a single run.
    """

    def test_direct_timeout_propagates_without_tagging(self):
        xform = self._mock_xform()
        with patch.object(
            job_0027, 'call_command', side_effect=SoftTimeLimitExceeded()
        ):
            with patch.object(
                job_0027.Instance.objects, 'bulk_update', side_effect=IntegrityError()
            ):
                with self.assertRaises(SoftTimeLimitExceeded):
                    job_0027._process_instances_batch(xform, self._mock_queryset())
        xform.tags.add.assert_not_called()

    def test_finds_timeout_nested_deep(self):
        timeout = SoftTimeLimitExceeded()
        inner = ValueError('inner')
        inner.__context__ = timeout
        outer = CommandError('outer')
        outer.__context__ = inner
        assert job_0027._find_timeout_in_chain(outer) is timeout

    def test_finds_timeout_wrapped_in_cause(self):
        timeout = TimeLimitExceeded()
        exc = CommandError('wrapped')
        exc.__cause__ = timeout
        assert job_0027._find_timeout_in_chain(exc) is timeout

    def test_finds_timeout_wrapped_in_context(self):
        timeout = SoftTimeLimitExceeded()
        try:
            try:
                raise timeout
            except SoftTimeLimitExceeded:
                raise CommandError('wrapped')
        except CommandError as exc:
            assert job_0027._find_timeout_in_chain(exc) is timeout

    def test_returns_direct_soft_time_limit(self):
        exc = SoftTimeLimitExceeded()
        assert job_0027._find_timeout_in_chain(exc) is exc

    def test_returns_direct_time_limit(self):
        exc = TimeLimitExceeded()
        assert job_0027._find_timeout_in_chain(exc) is exc

    def test_returns_none_when_no_timeout(self):
        exc = CommandError('just a data error')
        assert job_0027._find_timeout_in_chain(exc) is None

    def test_run_deletes_cursor_on_completion(self):
        with patch.object(job_0027, '_check_lrm_0005_is_completed'), \
                patch.object(job_0027, 'use_db'), \
                patch.object(job_0027, 'cache') as mock_cache, \
                patch.object(
                    job_0027, 'get_xforms_queryset', return_value=([], -1)
                ):
            mock_cache.get.return_value = 0
            job_0027.run()

        mock_cache.delete.assert_called_once_with(job_0027.LAST_XFORM_ID_CACHE_KEY)
        mock_cache.set.assert_not_called()

    def test_run_persists_cursor_only_after_batch_fully_processed(self):
        xform_a = self._mock_xform()
        xform_b = self._mock_xform()
        with patch.object(job_0027, '_check_lrm_0005_is_completed'), \
                patch.object(job_0027, 'use_db'), \
                patch.object(job_0027, 'cache') as mock_cache, \
                patch.object(
                    job_0027,
                    'get_xforms_queryset',
                    side_effect=[([xform_a, xform_b], 99), ([], -1)],
                ), \
                patch.object(job_0027, 'get_instances_queryset', return_value=None):
            mock_cache.get.return_value = 0
            job_0027.run()

        # `cache.set` must not fire until both XForms in the batch are done,
        # not once per XForm.
        mock_cache.set.assert_called_once_with(
            job_0027.LAST_XFORM_ID_CACHE_KEY, 99, timeout=None
        )
        mock_cache.delete.assert_called_once_with(job_0027.LAST_XFORM_ID_CACHE_KEY)

    def test_run_resumes_from_persisted_cursor(self):
        with patch.object(job_0027, '_check_lrm_0005_is_completed'), \
                patch.object(job_0027, 'use_db'), \
                patch.object(job_0027, 'cache') as mock_cache, \
                patch.object(
                    job_0027, 'get_xforms_queryset', return_value=([], -1)
                ) as mock_get_xforms:
            mock_cache.get.return_value = 42
            job_0027.run()

        mock_cache.get.assert_called_once_with(job_0027.LAST_XFORM_ID_CACHE_KEY, 0)
        mock_get_xforms.assert_called_once_with(42)

    def test_stops_on_context_cycle(self):
        first = ValueError('first')
        second = ValueError('second')
        first.__context__ = second
        second.__context__ = first
        assert job_0027._find_timeout_in_chain(first) is None

    def test_unrecoverable_error_tags_failed(self):
        xform = self._mock_xform()
        with patch.object(
            job_0027, 'call_command', side_effect=CommandError('genuine data error')
        ):
            with patch.object(
                job_0027.Instance.objects, 'bulk_update', side_effect=IntegrityError()
            ):
                result = job_0027._process_instances_batch(
                    xform, self._mock_queryset()
                )
        assert result is False
        xform.tags.add.assert_called_once_with(job_0027.FAILED_TAG)

    def test_wrapped_timeout_propagates_without_tagging(self):
        xform = self._mock_xform()
        timeout = SoftTimeLimitExceeded()
        wrapped = CommandError(
            'command has completed with errors: SoftTimeLimitExceeded()'
        )
        wrapped.__cause__ = timeout
        with patch.object(job_0027, 'call_command', side_effect=wrapped):
            with patch.object(
                job_0027.Instance.objects, 'bulk_update', side_effect=IntegrityError()
            ):
                with self.assertRaises(SoftTimeLimitExceeded):
                    job_0027._process_instances_batch(xform, self._mock_queryset())
        xform.tags.add.assert_not_called()

    @staticmethod
    def _mock_queryset():
        queryset = MagicMock()
        queryset.iterator.return_value = iter([MagicMock(pk=10)])
        return queryset

    @staticmethod
    def _mock_xform():
        xform = MagicMock()
        xform.pk = 1
        xform.id_string = 'a_form'
        return xform


class SyncMongoRootUuidCursorTestCase(SimpleTestCase):
    """
    Covers the Redis-persisted pagination cursor: instances belonging to
    XForms LRM 0027 permanently skips (pending_delete, or tagged failed)
    never get `meta/rootUuid` set, so a plain in-memory cursor would re-scan
    past them from `_id` 0 on every Celery restart, potentially never
    reaching a fully empty batch within a single run.

    `settings.MONGO_DB` is already `mongomock` in the test environment (see
    `kobo/settings/testing.py`), so these hit it directly instead of mocking
    the pymongo call chain.
    """

    def setUp(self):
        super().setUp()
        job_0028.settings.MONGO_DB.instances.delete_many({})

    def test_run_deletes_cursor_on_completion(self):
        with patch.object(job_0028, '_check_lrm_0027_is_completed'), \
                patch.object(job_0028, 'cache') as mock_cache:
            mock_cache.get.return_value = 0
            job_0028.run()

        mock_cache.delete.assert_called_once_with(job_0028.LAST_ID_CACHE_KEY)
        mock_cache.set.assert_not_called()

    def test_run_persists_cursor_after_batch(self):
        job_0028.settings.MONGO_DB.instances.insert_many(
            [{'_id': 10}, {'_id': 20}]
        )
        with patch.object(job_0028, '_check_lrm_0027_is_completed'), \
                patch.object(job_0028, 'cache') as mock_cache, \
                patch.object(job_0028, '_process_batch') as mock_process_batch:
            mock_cache.get.return_value = 0
            job_0028.run()

        processed_ids = [doc['_id'] for doc in mock_process_batch.call_args[0][0]]
        assert processed_ids == [10, 20]
        mock_cache.set.assert_called_once_with(
            job_0028.LAST_ID_CACHE_KEY, 20, timeout=None
        )
        mock_cache.delete.assert_called_once_with(job_0028.LAST_ID_CACHE_KEY)

    def test_run_resumes_from_persisted_cursor(self):
        job_0028.settings.MONGO_DB.instances.insert_many(
            [{'_id': 42}, {'_id': 50}]
        )
        with patch.object(job_0028, '_check_lrm_0027_is_completed'), \
                patch.object(job_0028, 'cache') as mock_cache, \
                patch.object(job_0028, '_process_batch') as mock_process_batch:
            mock_cache.get.return_value = 42
            job_0028.run()

        # `_id` 42 was already seen before the restart; only 50 should surface.
        processed_ids = [doc['_id'] for doc in mock_process_batch.call_args[0][0]]
        assert processed_ids == [50]
