import csv
import sys
from collections import defaultdict
from copy import deepcopy
from itertools import islice

from django.db.models import Prefetch
from django.contrib.contenttypes.models import ContentType

from kpi.db_routers import HitTheRoadDatabaseRouter
route_to_dest = HitTheRoadDatabaseRouter.route_to_destination

from kpi.deployment_backends.kc_access.shadow_models import KobocatUser
from kpi.utils.permissions import grant_default_model_level_perms

# Imports are in a weird order because below are the models being copied

from django.contrib.auth.models import User, Permission
from allauth.account.models import EmailAddress
from hub.models.extra_user_detail import ExtraUserDetail
from rest_framework.authtoken.models import Token
from django_digest.models import PartialDigest
# from django.contrib.auth.models import User_user_permissions
from kpi.models.asset import Asset
from kpi.models.asset_file import AssetFile
from kobo.apps.subsequences.models import SubmissionExtras
from kpi.models.asset_export_settings import AssetExportSettings
from kpi.models.asset_version import AssetVersion
from kobo.apps.hook.models.hook import Hook
from kobo.apps.hook.models.hook_log import HookLog
from kpi.models.object_permission import ObjectPermission
from kpi.models.asset_user_partial_permission import AssetUserPartialPermission
from kpi.models.asset import UserAssetSubscription

# Not necessary to import these since they're only accessed by the manager on
# Asset
# from taggit.models import TaggedItem
# from taggit.models import Tag

# Make no attempt to migrate TagUids. They're not needed, and the same tag
# would have different UIDs on different servers—and this job has to work with
# two source servers into a single destination
# from kpi.models.tag_uid import TagUid


# LESSONS
# `XForm.kpi_asset_uid` is NOT consistently populated!!!
# Make the UIDs PKs!
# EVERYTHING gets a UID. Why doesn't SubmissionExtras have one?


# to be replaced by reading usernames from a file
# all_users_qs = User.objects.filter(username__in=('tinok', 'tinok3', 'tino', 'jamesld_test'))

usernames = [x.strip() for x in open('htr-usernames.txt').readlines()]
all_users_qs = User.objects.filter(username__in=usernames)
csv_file_writer = csv.writer(
    open(f'kpi-hittheroad-{datetime.datetime.now()}.log', 'w')


CHUNK_SIZE = 2000

counts = defaultdict(lambda: 1)

csv_writer = csv.writer(sys.stdout)


def print_csv(*args):
    csv_writer.writerow((datetime.datetime.now(),) + args)
    csv_file_writer.writerow((datetime.datetime.now(),) + args)


def legible_class(cls):
    return f'{cls.__module__}.{cls.__name__}'


class SkipObject(Exception):
    pass


def disable_auto_now(model):
    for field in model._meta.fields:
        for bad in ('auto_now', 'auto_now_add'):
            if hasattr(field, bad):
                setattr(field, bad, False)


def copy_related_objs(
    qs,
    related_fk_field,
    related_qs,
    nat_key: list = None,
    retain_pk=False,
    fixup: callable = None,
):
    disable_auto_now(qs.model)
    obj_iter = qs.filter(**{related_fk_field + '__in': related_qs}).iterator(
        chunk_size=CHUNK_SIZE
    )
    related_id_field = f'{related_fk_field}_id'
    try:
        related_source_to_dest_pks = source_to_dest_pks[related_qs.model]
    except KeyError:
        raise Exception(
            f'{related_qs.model} must be copied with `nat_key` specified before'
            f' {qs.model} can be copied'
        )
    this_model_source_to_dest_pks = source_to_dest_pks.setdefault(qs.model, {})
    while True:
        objs = list(islice(obj_iter, CHUNK_SIZE))
        if not objs:
            break
        nat_key_to_source_pks = {}
        objs_to_create = []
        for obj in objs:
            print_csv(
                legible_class(qs.model), obj.pk, f'({counts[qs.model]} done)'
            )
            counts[qs.model] += 1
            source_obj_pk = obj.pk
            if nat_key:
                nat_key_vals = tuple(getattr(obj, f) for f in nat_key)
                nat_key_to_source_pks[nat_key_vals] = source_obj_pk
            if not retain_pk:
                obj.pk = None
            source_related_id = getattr(obj, related_id_field)
            try:
                dest_related_id = related_source_to_dest_pks[source_related_id]
            except KeyError:
                raise Exception(
                    f'{qs.model} # {source_obj_pk} expects {related_qs.model}'
                    f' # {source_related_id}, but it has not been copied'
                )
            setattr(obj, related_id_field, dest_related_id)
            if fixup:
                # We don't have all the time in the world… apply any necessary
                # hacks here
                try:
                    fixup(obj)
                except SkipObject:
                    continue
            objs_to_create.append(obj)
        with route_to_dest():
            created_objs = qs.model.objects.bulk_create(objs_to_create)
        if nat_key:
            for created_obj in created_objs:
                nat_key_vals = tuple(getattr(created_obj, f) for f in nat_key)
                this_model_source_to_dest_pks[
                    nat_key_to_source_pks[nat_key_vals]
                ] = created_obj.pk


source_to_dest_pks = {}
source_to_dest_pks[User] = {-1: -1}  # PK for AnonymousUser doesn't change

for user in all_users_qs:
    print_csv(
        legible_class(User), user.pk, user.username, f'({counts[User]} done)'
    )
    counts[User] += 1
    source_user_pk = user.pk
    user.pk = None
    with route_to_dest():
        User.objects.bulk_create([user])  # Avoids `save()` shenanigans?
        grant_default_model_level_perms(user)
        KobocatUser.sync(user)

    source_to_dest_pks[User][source_user_pk] = user.pk

    user_qs = User.objects.filter(username=user.username)

    # Directly related to User
    copy_related_objs(
        EmailAddress.objects.filter(primary=True, verified=True),
        'user',
        user_qs,
    )
    copy_related_objs(ExtraUserDetail.objects.all(), 'user', user_qs)
    copy_related_objs(Token.objects.all(), 'user', user_qs, retain_pk=True)
    copy_related_objs(PartialDigest.objects.all(), 'user', user_qs)
    copy_related_objs(
        Asset.objects.filter(parent=None), 'owner', user_qs, ['uid']
    )

    # Related to Asset
    asset_qs = Asset.objects.filter(owner__in=user_qs, parent=None)

    def set_assetfile_user_to_asset_owner(assetfile):
        # HACK: Just™ ignore the possibility that the user who actually created
        # the AssetFile is not the owner of the related Asset
        assetfile.user_id = user.pk

    copy_related_objs(
        AssetFile.objects.all(),
        'asset',
        asset_qs,
        ['uid'],
        fixup=set_assetfile_user_to_asset_owner,
    )

    copy_related_objs(
        SubmissionExtras.objects.all(),
        'asset',
        asset_qs,
        # Really, `unique_together = ['asset', 'submission_uuid']`, but to use
        # that, there'd have to be extra logic to xref 'asset' to 'asset__uid'
        ['date_created', 'date_modified', 'submission_uuid'],
        fixup=set_assetfile_user_to_asset_owner,
    )

    for mod in AssetExportSettings, Hook:
        copy_related_objs(
            mod.objects.all(),
            'asset',
            asset_qs,
            ['uid'],
        )

    def null_out_reversion_version_id(assetversion):
        if assetversion._reversion_version_id:
            csv_file_writer.writerow(
                [
                    'WOW! AssetVersion WITH REVERSION',
                    '<see AssetVersion PK above>',
                    f'_reversion_version_id: {assetversion._reversion_version_id}',
                ]
            )
            assetversion._reversion_version = None

    copy_related_objs(
        AssetVersion.objects.all(),
        'asset',
        asset_qs,
        ['uid'],
        fixup=null_out_reversion_version_id,
    )

    # Related to Hook
    copy_related_objs(
        HookLog.objects.all(),
        'hook',
        Hook.objects.filter(asset__in=asset_qs),
        ['uid'],
    )

    # Tags - inefficient, oh well
    for asset in asset_qs.only('uid').prefetch_related(
        Prefetch('tags', to_attr='prefetched_tags')
    ):  # iterator() doesn't seem to work with prefetch_related()
        tags = [t.name for t in asset.prefetched_tags]
        if not tags:
            continue
        with route_to_dest():
            Asset.objects.only('pk').get(uid=asset.uid).tags.set(tags)


# Ownership may change between child and parent Assets, so child assets must be
# created after all users and parent Assets have already been made


def update_parent_pk(asset):
    asset.parent_id = source_to_dest_pks[Asset][asset.parent_id]


copy_related_objs(
    Asset.objects.exclude(parent=None),
    'owner',
    all_users_qs,
    ['uid'],
    fixup=update_parent_pk,
)

# Things that depend on all users having been copied already


def update_asset_pk(obj_related_to_asset):
    try:
        obj_related_to_asset.asset_id = source_to_dest_pks[Asset][
            obj_related_to_asset.asset_id
        ]
    except KeyError:
        # Ignore permission assignments for Assets that are not part of the
        # migration
        raise SkipObject


copy_related_objs(
    UserAssetSubscription.objects.all(),
    'user',
    all_users_qs,
    fixup=update_asset_pk,
)

copy_related_objs(
    AssetUserPartialPermission.objects.all(),
    'user',
    all_users_qs,
    fixup=update_asset_pk,
)

# Cross-reference Permissions by app_label and model (from ContentType) and
# codename

source_permissions = list(
    Permission.objects.all().select_related('content_type')
)
source_permissions_xref = {
    (p.content_type.app_label, p.content_type.model, p.codename): p.pk
    for p in source_permissions
}
with route_to_dest():
    dest_permissions = list(
        Permission.objects.all().select_related('content_type')
    )
source_to_dest_pks[Permission] = {}
for p in dest_permissions:
    try:
        source_pk = source_permissions_xref[
            (p.content_type.app_label, p.content_type.model, p.codename)
        ]
    except KeyError:
        # Databases are weirdly inconsistent about the presence of permissions
        # for things like `shadow_model` and `gis`
        continue
    source_to_dest_pks[Permission][source_pk] = p.pk


def update_permission_pk(obj_related_to_permission):
    try:
        obj_related_to_permission.permission_id = source_to_dest_pks[Permission][
            obj_related_to_permission.permission_id
        ]
    except KeyError:
        # See comment above; likely would be cleaner to consider only a list of
        # permissions that matter instead of whatever happens to be in each
        # database
        raise SkipObject


def update_permission_and_asset_pk(obj):
    update_asset_pk(obj)
    update_permission_pk(obj)


copy_related_objs(
    ObjectPermission.objects.all(),
    'user',
    all_users_qs,
    fixup=update_permission_and_asset_pk,
)

''' Zafacón
def DEBUG__clean_up():
    with route_to_dest():
        # `QuerySet.all()` copies the queryset. Is it necessary…?
        print(all_users_qs.all().delete())

        from taggit.models import TaggedItem
        from taggit.models import Tag

        # from kpi.models.tag_uid import TagUid
        print(Tag.objects.all().delete())
        print(TaggedItem.objects.all().delete())
'''
