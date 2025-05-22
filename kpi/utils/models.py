import contextlib
import copy
import re
import time
from abc import ABC
from collections import defaultdict
from urllib.parse import urlparse

from django.apps import apps
from django.conf import settings
from django.db import connections, transaction, OperationalError
from django.db import models
from django.db.models import F
from django.db.models.expressions import CombinedExpression
from django.urls import Resolver404, resolve
from taggit.models import Tag, TaggedItem

from kpi.constants import ASSET_TYPE_COLLECTION
from kpi.utils.log import logging


TAG_RE = r'tag:(.*)'


def _load_library_content(structure):

    Asset = apps.get_model('kpi', 'Asset')  # noqa

    content = structure.get('content', {})
    if 'library' not in content:
        raise Exception('to load a library, you must have a sheet called "library"')
    library_sheet = content.get('library', [])
    del content['library']

    tag_name_to_pk = {}  # Both a cache and a record of what to index later
    created_asset_pks = []  # A list of what to index at the end of the import

    grouped = defaultdict(list)
    for row in library_sheet:
        # preserve the additional sheets of imported library (but not the library)
        row_tags = []
        row_copy = dict(row)
        for key, val in row_copy.items():
            if str(val).lower() in ['false', '0', 'no', 'n', '', 'none']:
                continue
            if re.search(TAG_RE, key):
                tag_name = re.match(TAG_RE, key).groups()[0]
                row_tags.append(tag_name)
                tag_name_to_pk[tag_name] = None # Will be filled in later
                del row[key]
        block_name = row.pop('block', None)
        grouped[block_name].append((row, row_tags,))

    # Resolve tag names to PKs
    existing_tags = Tag.objects.filter(
        name__in=tag_name_to_pk.keys()).values_list('name', 'pk')
    existing_tags_dict = dict(existing_tags)
    tag_name_to_pk.update(existing_tags_dict)
    if existing_tags.count() < len(tag_name_to_pk.keys()):
        import_tag_names = set(tag_name_to_pk.keys())
        existing_tag_names = set(existing_tags_dict.keys())
        for new_tag_name in import_tag_names.difference(existing_tag_names):
            # We're not atomic, but get_or_create should be
            new_tag, created = Tag.objects.get_or_create(name=new_tag_name)
            tag_name_to_pk[new_tag_name] = new_tag.pk

    collection_name = structure['name']
    if not collection_name:
        collection_name = 'Collection'

    collection = Asset.objects.create(
        asset_type=ASSET_TYPE_COLLECTION, owner=structure['owner'],
        name=collection_name
    )

    for block_name, rows in grouped.items():
        if block_name is None:
            for (row, row_tags) in rows:
                scontent = copy.deepcopy(content)
                scontent['survey'] = [row]
                sa = Asset.objects.create(
                    content=scontent,
                    asset_type='question',
                    owner=structure['owner'],
                    parent=collection,
                    update_parent_languages=False,
                )
                created_asset_pks.append(sa.pk)
                for tag_name in row_tags:
                    ti = TaggedItem.objects.create(
                        tag_id=tag_name_to_pk[tag_name],
                        content_object=sa
                    )
        else:
            block_rows = []
            block_tags = set()
            for (row, row_tags) in rows:
                for tag in row_tags:
                    block_tags.add(tag)
                block_rows.append(row)
            scontent = copy.deepcopy(content)
            scontent['survey'] = block_rows
            sa = Asset.objects.create(
                content=scontent,
                asset_type='block',
                name=block_name,
                parent=collection,
                owner=structure['owner'],
                update_parent_languages=False,
            )
            created_asset_pks.append(sa.pk)
            for tag_name in block_tags:
                ti = TaggedItem.objects.create(
                    tag_id=tag_name_to_pk[tag_name],
                    content_object=sa
                )

    # To improve performance, we deferred this until the end using
    # `update_parent_languages=False`
    collection.update_languages()
    return collection


def _set_auto_field_update(kls, field_name, val):
    field = [f for f in kls._meta.fields if f.name == field_name][0]
    field.auto_now = val
    field.auto_now_add = val


def create_assets(kls, structure, **options):
    Asset = apps.get_model('kpi', 'Asset')  # noqa

    if kls == 'collection':
        obj = Asset.objects.create(
            asset_type=ASSET_TYPE_COLLECTION, **structure
        )
    elif kls == 'asset':
        if 'library' in structure.get('content', {}):
            obj = _load_library_content(structure)
        else:
            obj = Asset.objects.create(**structure)
    return obj


@contextlib.contextmanager
def disable_auto_field_update(kls, field_name):
    field = [f for f in kls._meta.fields if f.name == field_name][0]
    original_auto_now = field.auto_now
    original_auto_now_add = field.auto_now_add
    field.auto_now = False
    field.auto_now_add = False
    try:
        yield
    finally:
        field.auto_now = original_auto_now
        field.auto_now_add = original_auto_now_add


def remove_string_prefix(string, prefix):
    if prefix and string.startswith(prefix):
        return string[len(prefix):]
    else:
        return string


def resolve_url_to_asset(item_path):
    Asset = apps.get_model('kpi', 'Asset')
    # TODO: is this still necessary now that `Collection` has been removed?
    if item_path.startswith(('http', 'https')):
        item_path = urlparse(item_path).path
    try:
        match = resolve(item_path)
    except Resolver404:
        # If the app is mounted in uWSGI with a path prefix, try to resolve
        # again after removing the prefix
        match = resolve(remove_string_prefix(item_path, settings.KPI_PREFIX))

    uid = match.kwargs.get('uid')
    return Asset.objects.get(uid=uid)

class DjangoModelABCMetaclass(type(models.Model), type(ABC)):
    """
    This metaclass combines Django Model meta class and ABC meta class.
    Needed to be passed as the meta class for classes that inherit from the
    two others.
    """
    pass

class SafePostCommitQuerySet(models.QuerySet):

    def update_on_commit(
        self,
        retries: int = 5,
        delay: float = 0.05,
        lock_timeout: int = 0.2,
        **kwargs
    ):
        """
        Perform an UPDATE after the current transaction commits, using FOR UPDATE NOWAIT
        to avoid blocking.
        Supports basic F expressions and math.
        """
        model = self.model
        table = model._meta.db_table
        connection = connections[self._db]
        compiler = self.query.get_compiler(using=self._db)

        # WHERE clause
        where_sql, where_params = self.query.where.as_sql(
            compiler=compiler, connection=connection
        )

        # SET clause
        set_clauses = []
        set_params = []

        for field, value in kwargs.items():
            if isinstance(value, CombinedExpression):
                # Only support F('field') ± int|float
                lhs, rhs = value.lhs, value.rhs
                if (
                    not isinstance(lhs, F)
                    or not isinstance(rhs, (int, float))
                    or lhs.name != field
                ):
                    raise ValueError(
                        f"Only `F('{field}') ± int|float` is supported for {field}"
                    )
                set_clauses.append(f"{field} = {field} {value.connector} %s")
                set_params.append(rhs)
            else:
                set_clauses.append(f"{field} = %s")
                set_params.append(value)

        sql = f"""
            WITH row AS (
                SELECT 1 FROM {table}
                WHERE {where_sql}
                FOR UPDATE NOWAIT
            )
            UPDATE {table}
            SET {', '.join(set_clauses)}
            FROM row
            WHERE {where_sql};
        """

        def _execute():
            for attempt in range(1, retries + 1):
                try:
                    with connection.cursor() as cursor:
                        lock_timeout_ms = lock_timeout * 1000
                        cursor.execute(
                            f"SET LOCAL lock_timeout = '{lock_timeout_ms}ms';"
                        )
                        cursor.execute(sql, where_params + set_params + where_params)
                    return
                except OperationalError as e:
                    if (
                        'could not obtain lock on row' in str(e)
                        or 'canceling statement due to lock timeout' in str(e)
                    ):
                        if attempt < retries - 1:
                            time.sleep(delay * (2 ** attempt))
                            continue

                        logging.error(
                            'safe_post_commit_update failed after retries',
                            exc_info=True,
                        )
                    raise

        if transaction.get_connection().in_atomic_block:
            transaction.on_commit(_execute)
        else:
            _execute()
