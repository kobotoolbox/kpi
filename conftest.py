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

    This fixture replaces pytest-django's `django_db_setup` and takes the same
    arguments. `django_test_environment` and `django_db_modify_db_settings` are
    only requested for their side effects: the second one appends the worker id
    to the test database name (`test_kpi_test_gw0`, `test_kpi_test_gw1`, ...).

    Without xdist, or with `--reuse-db`, it behaves like pytest-django's
    fixture. With xdist, pytest-django would create one test database per
    worker and run all migrations on each one, which takes about a minute per
    worker. Instead, the migrations run once, on an extra Postgres database
    called the template database (`test_kpi_test_template`). No test runs on
    it, it only serves as a model: each worker gets its own test database as a
    copy of it, with `CREATE DATABASE <worker db> WITH TEMPLATE <template db>`.
    Postgres copies the database files directly, which takes seconds.

    Tests use a single database (`default`), so only `connection` is handled.
    """

    from django.test.utils import setup_databases, teardown_databases

    # Only set on xdist workers. It holds the worker id (`gw0`, ...) and the
    # run id that the controller shares with all its workers.
    worker_input = getattr(request.config, 'workerinput', None)
    # Same rule as pytest-django: `--create-db` wins over `--reuse-db`
    reuse_db = django_db_keepdb and not django_db_createdb

    # `--nomigrations`
    if not django_db_use_migrations:
        from pytest_django.fixtures import _disable_migrations

        _disable_migrations()

    # Same steps as pytest-django's fixture. A database that `--reuse-db`
    # keeps is already migrated, so a template database would not save
    # anything.
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
    # Once the worker suffix is removed, every worker gets the same name, so
    # they all share one template database (`test_kpi_test_template`).
    worker_db_name = connection.settings_dict['TEST']['NAME']
    template_db_name = _template_db_name(
        worker_db_name.removesuffix(f'_{worker_id}')
    )
    # The lock file and the `template_ready` marker live in a directory that
    # all workers of this run share.
    run_dir = _xdist_run_dir(worker_input['testrunuid'])
    run_dir.mkdir(exist_ok=True)
    # The worker that builds the template database creates this file once
    # the migrations on it are done. Workers that see the file skip the build
    # and only copy the template database.
    template_ready = run_dir / 'template_ready'

    with django_db_blocker.unblock():
        # Original database name (from `DATABASE_URL`), which
        # `destroy_test_db()` restores on teardown
        old_db_name = connection.settings_dict['NAME']

        # The lock makes workers take turns. The first one builds the template
        # database while the others wait, because Postgres refuses to copy a
        # database that another session is connected to. The copies then run
        # one after the other. Closing the file releases the lock, even if the
        # build raises an exception.
        with open(run_dir / 'lock', 'w') as lock_file:
            fcntl.flock(lock_file, fcntl.LOCK_EX)
            if not template_ready.exists():
                _create_template_db(template_db_name, verbosity)
                template_ready.touch()
            _clone_template_db(template_db_name, worker_db_name)

    yield

    with django_db_blocker.unblock():
        # Drop this worker's database only. The controller drops the template
        # database in `pytest_sessionfinish()`, after all workers are done.
        connection.creation.destroy_test_db(old_db_name, verbosity)


def pytest_sessionfinish(session):
    """
    Drop the template database once all xdist workers are done.

    This hook runs in the controller and in every worker. Only the controller
    drops the template, because it finishes after all its workers.
    """

    if hasattr(session.config, 'workerinput'):
        return

    # No run id means xdist did not run. No run directory means no worker
    # built a template database (`--reuse-db`).
    testrunuid = getattr(session.config, 'testrunuid', None)
    if testrunuid is None or not _xdist_run_dir(testrunuid).exists():
        return

    # The controller never runs `django_db_modify_db_settings`, so its test
    # database name has no worker suffix. It is the name that the workers get
    # once they remove theirs. Without `TEST['NAME']`, Django uses
    # `test_<NAME>`.
    test_db_name = connection.settings_dict.get('TEST', {}).get('NAME')
    template_db_name = _template_db_name(
        test_db_name or f"test_{connection.settings_dict['NAME']}"
    )
    # pytest-django blocks database access outside the fixtures that unblock
    # it. A hook cannot request the `django_db_blocker` fixture, so it reaches
    # the same blocker through the config stash.
    with session.config.stash[blocking_manager_key].unblock():
        # A session cannot drop the database that it is connected to, so this
        # cursor connects to the `postgres` maintenance database instead.
        with connection.creation._nodb_cursor() as cursor:
            cursor.execute(f'DROP DATABASE IF EXISTS "{template_db_name}"')


@pytest.hookimpl(optionalhook=True)
def pytest_configure_node(node):
    """
    Let the controller know the run id that xdist shares with its workers.

    xdist generates the run id in the controller but only hands it to the
    workers, in `workerinput`. This hook runs in the controller before each
    worker starts, and `node.config` is the controller's config, which is where
    `pytest_sessionfinish()` reads it.

    `optionalhook` keeps pytest from rejecting this hook when xdist is not
    loaded (e.g. `-p no:xdist`).
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
    """
    Create `target_db_name` as a copy of the template database and point the
    connection to it.
    """

    # This cursor connects to the `postgres` maintenance database, because
    # Postgres refuses to copy a database that a session is connected to.
    with connection.creation._nodb_cursor() as cursor:
        # A previous run that crashed can leave this worker's database behind
        cursor.execute(f'DROP DATABASE IF EXISTS "{target_db_name}"')
        cursor.execute(
            f'CREATE DATABASE "{target_db_name}" WITH TEMPLATE "{template_db_name}"'
        )
    # Same switch as Django's `create_test_db()`: the next query opens a new
    # connection to the clone.
    connection.close()
    settings.DATABASES[connection.alias]['NAME'] = target_db_name
    connection.settings_dict['NAME'] = target_db_name


def _create_template_db(template_db_name: str, verbosity: int):
    """
    Migrate the template database and add what migrations do not create.

    `create_test_db()` names the database after `TEST['NAME']`, so the worker's
    name is swapped for the template's during the call and restored afterwards.
    """

    old_db_name = connection.settings_dict['NAME']
    worker_db_name = connection.settings_dict['TEST']['NAME']
    connection.settings_dict['TEST']['NAME'] = template_db_name
    try:
        # `autoclobber` drops a template database that a crashed run left
        # behind.
        # `serialize` only matters for `serialized_rollback`, which no test
        # uses, and it would be lost on the clones anyway.
        connection.creation.create_test_db(
            verbosity=verbosity, autoclobber=True, serialize=False
        )
        # Every clone inherits the materialized view, so the
        # `user_reports_materialized_view` fixture finds it and does nothing.
        _create_user_reports_mv()
    finally:
        # `create_test_db()` left the connection open on the template database
        # and pointed the settings to it. Close the connection, because
        # Postgres refuses to copy a database that a session is connected to,
        # and restore the names.
        connection.close()
        connection.settings_dict['TEST']['NAME'] = worker_db_name
        connection.settings_dict['NAME'] = old_db_name
        settings.DATABASES[connection.alias]['NAME'] = old_db_name


def _create_user_reports_mv():
    """
    Create the user_reports materialized view and its indexes, unless the
    database already has them.
    """

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
    """
    Return the directory that the controller and all workers of one xdist run
    share. Each run gets a new run id, so a `template_ready` marker that an
    earlier run left behind is never seen.
    """

    return Path(tempfile.gettempdir()) / f'kpi-pytest-{testrunuid}'
