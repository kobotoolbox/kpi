import fcntl
import os
import tempfile
from pathlib import Path

import pytest
from django.conf import settings
from django.db import connection
from pytest import fixture
from pytest_django.plugin import blocking_manager_key

from kobo.apps.user_reports.utils.migrations import (
    CREATE_INDEXES_SQL,
    CREATE_MV_SQL,
)
from kpi.utils.object_permission import get_anonymous_user


@fixture(scope='session')
def django_db_setup(
    request,
    django_test_environment,
    django_db_blocker,
    django_db_use_migrations,
    django_db_keepdb,
    django_db_createdb,
    django_db_modify_db_settings,
):
    """
    Build the test database once per run and clone it for each xdist worker.

    Without xdist, or with `--reuse-db`, this behaves like pytest-django's
    own fixture. With xdist, the first worker to take the lock migrates a
    template database, and every worker then clones it with
    `CREATE DATABASE ... TEMPLATE`, which takes seconds instead of running
    all migrations once per worker.
    """

    from django.test.utils import setup_databases, teardown_databases

    worker_input = getattr(request.config, 'workerinput', None)
    reuse_db = django_db_keepdb and not django_db_createdb

    if not django_db_use_migrations:
        from pytest_django.fixtures import _disable_migrations

        _disable_migrations()

    if worker_input is None or reuse_db:
        with django_db_blocker.unblock():
            db_cfg = setup_databases(
                verbosity=request.config.option.verbose,
                interactive=False,
                keepdb=reuse_db,
            )
        yield
        if not reuse_db:
            with django_db_blocker.unblock():
                teardown_databases(
                    db_cfg, verbosity=request.config.option.verbose
                )
        return

    verbosity = request.config.option.verbose
    worker_id = worker_input['workerid']
    worker_db_name = connection.settings_dict['TEST']['NAME']
    template_db_name = _template_db_name(
        worker_db_name.removesuffix(f'_{worker_id}')
    )
    run_dir = _xdist_run_dir(worker_input['testrunuid'])
    run_dir.mkdir(exist_ok=True)
    template_ready = run_dir / 'template_ready'

    with django_db_blocker.unblock():
        old_db_name = connection.settings_dict['NAME']

        # Building the template and cloning it both need the lock: Postgres
        # refuses to copy a template database while another session uses it.
        with open(run_dir / 'lock', 'w') as lock_file:
            fcntl.flock(lock_file, fcntl.LOCK_EX)
            if not template_ready.exists():
                _create_template_db(template_db_name, verbosity)
                template_ready.touch()
            _clone_template_db(template_db_name, worker_db_name)

    yield

    with django_db_blocker.unblock():
        connection.creation.destroy_test_db(old_db_name, verbosity)


def pytest_sessionfinish(session):
    """
    Drop the template database once all xdist workers are done.
    """

    if hasattr(session.config, 'workerinput'):
        return

    testrunuid = getattr(session.config, 'testrunuid', None)
    if testrunuid is None or not _xdist_run_dir(testrunuid).exists():
        return

    test_db_name = connection.settings_dict.get('TEST', {}).get('NAME')
    template_db_name = _template_db_name(
        test_db_name or f"test_{connection.settings_dict['NAME']}"
    )
    with session.config.stash[blocking_manager_key].unblock():
        with connection.creation._nodb_cursor() as cursor:
            cursor.execute(f'DROP DATABASE IF EXISTS "{template_db_name}"')


@pytest.hookimpl(optionalhook=True)
def pytest_configure_node(node):
    """
    Let the controller know the run id that xdist shares with its workers.
    """

    node.config.testrunuid = node.workerinput['testrunuid']


@fixture(scope='session', autouse=True)
def mock_s3_when_needed():
    """
    Activate moto's S3 mock for the entire test session when the default
    storage backend is S3Boto3Storage. No-ops when InMemoryStorage is used.

    This fixture lives at the project root so it applies to all test paths
    (kobo/, kpi/, hub/). A conftest.py in a subdirectory only covers tests
    within that subtree.
    """

    if not settings.STORAGES['default']['BACKEND'].endswith('S3Boto3Storage'):
        yield
        return

    import boto3
    from moto import mock_aws

    dummy_env_vars = {
        'AWS_ACCESS_KEY_ID': 'testing',
        'AWS_SECRET_ACCESS_KEY': 'testing',
        'AWS_DEFAULT_REGION': 'us-east-1',
    }
    originals = {k: os.environ.get(k) for k in dummy_env_vars}
    os.environ.update(dummy_env_vars)

    try:
        with mock_aws():
            region = settings.AWS_S3_REGION_NAME
            bucket = settings.AWS_STORAGE_BUCKET_NAME
            s3 = boto3.client('s3', region_name=region)
            if region == 'us-east-1':
                s3.create_bucket(Bucket=bucket)
            else:
                s3.create_bucket(
                    Bucket=bucket,
                    CreateBucketConfiguration={'LocationConstraint': region},
                )
            yield
    finally:
        for k, v in originals.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v


@fixture(scope='session', autouse=True)
def anonymous_user(django_db_setup, django_db_blocker):
    # Create the AnonymousUser record once for the entire test session.
    # Previously this ran before every test (function scope), causing a DB
    # hit per test even though the record never changes.
    with django_db_blocker.unblock():
        return get_anonymous_user()


@fixture(scope='session', autouse=True)
def user_reports_materialized_view(django_db_setup, django_db_blocker):
    # The user_reports MV is dropped by migration 0008_drop_mv_before_djstripe
    # and recreated in production by a long-running migration that doesn't run
    # during tests. Create it here so tests calling
    # `refresh_user_reports_materialized_view` don't fail.

    with django_db_blocker.unblock():
        _create_user_reports_mv()


def _clone_template_db(template_db_name: str, target_db_name: str):
    with connection.creation._nodb_cursor() as cursor:
        cursor.execute(f'DROP DATABASE IF EXISTS "{target_db_name}"')
        cursor.execute(
            f'CREATE DATABASE "{target_db_name}" WITH TEMPLATE "{template_db_name}"'
        )
    connection.close()
    settings.DATABASES[connection.alias]['NAME'] = target_db_name
    connection.settings_dict['NAME'] = target_db_name


def _create_template_db(template_db_name: str, verbosity: int):
    """
    Migrate the template database and add what migrations do not create.
    """

    old_db_name = connection.settings_dict['NAME']
    worker_db_name = connection.settings_dict['TEST']['NAME']
    connection.settings_dict['TEST']['NAME'] = template_db_name
    try:
        connection.creation.create_test_db(
            verbosity=verbosity, autoclobber=True, serialize=False
        )
        _create_user_reports_mv()
    finally:
        # Postgres cannot use the template while this session is still open
        connection.close()
        connection.settings_dict['TEST']['NAME'] = worker_db_name
        connection.settings_dict['NAME'] = old_db_name
        settings.DATABASES[connection.alias]['NAME'] = old_db_name


def _create_user_reports_mv():
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT 1 FROM pg_matviews WHERE matviewname = 'user_reports_userreportsmv'"
        )
        if cursor.fetchone() is None:
            cursor.execute(CREATE_MV_SQL)
            cursor.execute(CREATE_INDEXES_SQL)


def _template_db_name(test_db_name: str) -> str:
    return f'{test_db_name}_template'


def _xdist_run_dir(testrunuid: str) -> Path:
    return Path(tempfile.gettempdir()) / f'kpi-pytest-{testrunuid}'
