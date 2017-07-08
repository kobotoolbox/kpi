import contextlib
import copy
import re
import logging
from django.apps import apps
from django.db.models import Q
from django.contrib.contenttypes.models import ContentType
from django.contrib.auth.models import User, Permission
from django.conf import settings
from taggit.models import Tag, TaggedItem
from .models import Asset
from .models import Collection
from .models.object_permission import perm_parse
from .haystack_utils import update_object_in_search_index

'''
This circular import will bite you if you don't import kpi.models before
importing kpi.model_utils:
  File "kpi/model_utils.py", line 6, in <module>
    from .models import Asset
  File "kpi/models/__init__.py", line 5, in <module>
    from kpi.models.import_task import ImportTask
  File "kpi/models/import_task.py", line 6, in <module>
    from kpi.model_utils import create_assets
'''

TAG_RE = r'tag:(.*)'
from collections import defaultdict

def _load_library_content(structure):
    content = structure.get('content', {})
    if 'library' not in content:
        raise Exception('to load a library, you must have a sheet called "library"')
    library_sheet = content.get('library', [])
    del content['library']

    tag_name_to_pk = {} # Both a cache and a record of what to index later
    created_asset_pks = [] # A list of what to index at the end of the import

    grouped = defaultdict(list)
    for row in library_sheet:
        # preserve the additional sheets of imported library (but not the library)
        row_tags = []
        for key, val in row.items():
            if unicode(val).lower() in ['false', '0', 'no', 'n', '', 'none']:
                continue
            if re.search(TAG_RE, key):
                tag_name = re.match(TAG_RE, key).groups()[0]
                row_tags.append(tag_name)
                tag_name_to_pk[tag_name] = None # Will be filled in later
                del row[key]
        block_name = row.get('block', None)
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
    collection = Collection.objects.create(
        owner=structure['owner'], name=collection_name)

    with apps.get_app_config('haystack').signal_processor.defer():
        for block_name, rows in grouped.items():
            if block_name is None:
                for (row, row_tags) in rows:
                    scontent = copy.deepcopy(content)
                    scontent['survey'] = [row]
                    sa = Asset.objects.create(
                        content=scontent,
                        asset_type='question',
                        owner=structure['owner'],
                        parent=collection
                    )
                    created_asset_pks.append(sa.pk)
                    for tag_name in row_tags:
                        ti = TaggedItem.objects.create(
                            tag_id = tag_name_to_pk[tag_name],
                            content_object = sa
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
                    owner=structure['owner']
                )
                created_asset_pks.append(sa.pk)
                for tag_name in block_tags:
                    ti = TaggedItem.objects.create(
                        tag_id = tag_name_to_pk[tag_name],
                        content_object = sa
                    )

    # Update the search index
    for tag_pk in tag_name_to_pk.values():
        update_object_in_search_index(Tag.objects.get(pk=tag_pk))
    for asset_pk in created_asset_pks:
        asset = Asset.objects.get(pk=asset_pk)
        update_object_in_search_index(asset)

    return collection

def create_assets(kls, structure, **options):
    if kls == "collection":
        obj = Collection.objects.create(**structure)
    elif kls == "asset":
        if 'library' in structure.get('content', {}):
            obj = _load_library_content(structure)
        else:
            obj = Asset.objects.create(**structure)
    return obj

def grant_default_model_level_perms(user):
    ''' Gives ``user`` unrestricted model-level access to Collections, Assets,
    and everything listed in settings.KOBOCAT_DEFAULT_PERMISSION_CONTENT_TYPES.
    Without this, actions on individual instances are immediately denied and
    object-level permissions are never considered.  '''
    models_and_content_types = [Collection, Asset]
    try:
        for pair in settings.KOBOCAT_DEFAULT_PERMISSION_CONTENT_TYPES:
            models_and_content_types.append(ContentType.objects.get(
                app_label=pair[0],
                model=pair[1]
            ))
    except ContentType.DoesNotExist:
        # TODO: Warn that KC hasn't been installed?
        pass
    grant_all_model_level_perms(user, models_and_content_types)

def grant_all_model_level_perms(
        user, models_or_content_types, permissions_manager=Permission.objects
    ):
    ''' Utility function that gives ``user`` unrestricted model-level access
    to everything listed in ``models``. Without this, actions on individual
    instances are immediately denied and object-level permissions are never
    considered.
    The ``permissions_manager`` argument is for use in data migrations.
    '''
    content_types = []
    try:
        for item in models_or_content_types:
            if isinstance(item, ContentType):
                content_types.append(item)
            else:
                content_types.append(ContentType.objects.get_for_model(item))
    except TypeError:
        # models_or_content_types is a single item, not an iterable
        item = models_or_content_types
        if isinstance(item, ContentType):
            content_types.append(item)
        else:
            content_types.append(ContentType.objects.get_for_model(item))
    permissions_to_assign = permissions_manager.filter(
        content_type__in=content_types)
    if content_types and not permissions_to_assign.exists():
        raise Exception('No permissions found! You may need to migrate your '
            'database. Searched for content types {}.'.format(content_types))
    if user.pk == settings.ANONYMOUS_USER_ID:
        # The user is anonymous, so pare down the permissions to only those
        # that the configuration allows for anonymous users
        q_query = Q()
        for allowed_permission in settings.ALLOWED_ANONYMOUS_PERMISSIONS:
            app_label, codename = perm_parse(allowed_permission)
            q_query |= Q(content_type__app_label=app_label, codename=codename)
        permissions_to_assign = permissions_to_assign.filter(q_query)
    user.user_permissions.add(*permissions_to_assign)

@contextlib.contextmanager
def disable_auto_field_update(kls, field_name):
    field = filter(lambda f: f.name == field_name, kls._meta.fields)[0]
    original_auto_now = field.auto_now
    original_auto_now_add = field.auto_now_add
    field.auto_now = False
    field.auto_now_add = False
    try:
        yield
    finally:
        field.auto_now = original_auto_now
        field.auto_now_add = original_auto_now_add
