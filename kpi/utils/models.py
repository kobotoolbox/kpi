# coding: utf-8
import contextlib
import copy
import re
from abc import ABC
from collections import defaultdict

from django.apps import apps
from django.db import models
from taggit.models import Tag, TaggedItem

from kpi.constants import ASSET_TYPE_COLLECTION

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
    return string[len(prefix):] if string.startswith(prefix) else string


class DjangoModelABCMetaclass(type(models.Model), type(ABC)):
    """
    This metaclass combines Django Model meta class and ABC meta class.
    Needed to be passed as the meta class for classes that inherit from the
    two others.
    """
    pass
