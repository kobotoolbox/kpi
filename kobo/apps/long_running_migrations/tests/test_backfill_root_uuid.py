import importlib
from unittest.mock import MagicMock, patch

from celery.exceptions import SoftTimeLimitExceeded, TimeLimitExceeded
from django.core.management.base import CommandError
from django.db import IntegrityError
from django.test import SimpleTestCase

job = importlib.import_module(
    'kobo.apps.long_running_migrations.jobs.0027_backfill_remaining_root_uuid'
)


class BackfillRemainRootUuidTestCase(SimpleTestCase):

    def test_direct_timeout_propagates_without_tagging(self):
        xform = self._mock_xform()
        with patch.object(job, 'call_command', side_effect=SoftTimeLimitExceeded()):
            with patch.object(
                job.Instance.objects, 'bulk_update', side_effect=IntegrityError()
            ):
                with self.assertRaises(SoftTimeLimitExceeded):
                    job._process_instances_batch(xform, self._mock_queryset())
        xform.tags.add.assert_not_called()

    def test_finds_timeout_nested_deep(self):
        timeout = SoftTimeLimitExceeded()
        inner = ValueError('inner')
        inner.__context__ = timeout
        outer = CommandError('outer')
        outer.__context__ = inner
        assert job._find_timeout_in_chain(outer) is timeout

    def test_finds_timeout_wrapped_in_cause(self):
        timeout = TimeLimitExceeded()
        exc = CommandError('wrapped')
        exc.__cause__ = timeout
        assert job._find_timeout_in_chain(exc) is timeout

    def test_finds_timeout_wrapped_in_context(self):
        timeout = SoftTimeLimitExceeded()
        try:
            try:
                raise timeout
            except SoftTimeLimitExceeded:
                raise CommandError('wrapped')
        except CommandError as exc:
            assert job._find_timeout_in_chain(exc) is timeout

    def test_returns_direct_soft_time_limit(self):
        exc = SoftTimeLimitExceeded()
        assert job._find_timeout_in_chain(exc) is exc

    def test_returns_direct_time_limit(self):
        exc = TimeLimitExceeded()
        assert job._find_timeout_in_chain(exc) is exc

    def test_returns_none_when_no_timeout(self):
        exc = CommandError('just a data error')
        assert job._find_timeout_in_chain(exc) is None

    def test_stops_on_context_cycle(self):
        first = ValueError('first')
        second = ValueError('second')
        first.__context__ = second
        second.__context__ = first
        assert job._find_timeout_in_chain(first) is None

    def test_unrecoverable_error_tags_failed(self):
        xform = self._mock_xform()
        with patch.object(
            job, 'call_command', side_effect=CommandError('genuine data error')
        ):
            with patch.object(
                job.Instance.objects, 'bulk_update', side_effect=IntegrityError()
            ):
                result = job._process_instances_batch(xform, self._mock_queryset())
        assert result is False
        xform.tags.add.assert_called_once_with(job.FAILED_TAG)

    def test_wrapped_timeout_propagates_without_tagging(self):
        xform = self._mock_xform()
        timeout = SoftTimeLimitExceeded()
        wrapped = CommandError(
            'command has completed with errors: SoftTimeLimitExceeded()'
        )
        wrapped.__cause__ = timeout
        with patch.object(job, 'call_command', side_effect=wrapped):
            with patch.object(
                job.Instance.objects, 'bulk_update', side_effect=IntegrityError()
            ):
                with self.assertRaises(SoftTimeLimitExceeded):
                    job._process_instances_batch(xform, self._mock_queryset())
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
