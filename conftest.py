import os

from django.conf import settings
from django.db import connection
from pytest import fixture

from kobo.apps.user_reports.utils.migrations import (
    CREATE_INDEXES_SQL,
    CREATE_MV_SQL,
)
from kpi.utils.object_permission import get_anonymous_user


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

    os.environ['AWS_ACCESS_KEY_ID'] = 'testing'
    os.environ['AWS_SECRET_ACCESS_KEY'] = 'testing'
    os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'

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

    with django_db_blocker.unblock(), connection.cursor() as cursor:
        cursor.execute(
            "SELECT 1 FROM pg_matviews WHERE matviewname = 'user_reports_userreportsmv'"
        )
        if cursor.fetchone() is None:
            cursor.execute(CREATE_MV_SQL)
            cursor.execute(CREATE_INDEXES_SQL)
