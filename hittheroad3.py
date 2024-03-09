import csv
import datetime
import sys
from collections import defaultdict
from itertools import islice

from django.contrib.auth.models import User, Permission

from kpi.models.asset import Asset
from kpi.models.object_permission import ObjectPermission
from kpi.models.asset_user_partial_permission import AssetUserPartialPermission
from kpi.models.asset import UserAssetSubscription
from kpi.db_routers import HitTheRoadDatabaseRouter
route_to_dest = HitTheRoadDatabaseRouter.route_to_destination



some_usernames = []
usernames = [x.strip() for x in open('htr-usernames.txt').readlines()]
all_users_qs = User.objects.filter(username__in=usernames)
csv_file_writer = csv.writer(
    open(f'kpi-hittheroad3-{datetime.datetime.now()}.log', 'w')
)


CHUNK_SIZE = 2000

counts = defaultdict(lambda: 1)

csv_writer = csv.writer(sys.stdout)

def xref_all_users():
    with route_to_dest():
        dest_usernames_to_pks = {
            v[0]: v[1] for v in User.objects.values_list('username', 'pk')
        }
    source_usernames_to_pks = {
        v[0]: v[1]
        for v in User.objects.filter(
            username__in=dest_usernames_to_pks.keys()
        ).values_list('username', 'pk')
    }
    source_to_dest_pks[User] = {}
    for username, dest_pk in dest_usernames_to_pks.items():
        try:
            source_pk = source_usernames_to_pks[username]
        except KeyError:
            continue
        source_to_dest_pks[User][source_pk] = dest_pk


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
            created_objs = qs.model.objects.bulk_create(
                objs_to_create, ignore_conflicts=True
            )
        if nat_key:
            for created_obj in created_objs:
                nat_key_vals = tuple(getattr(created_obj, f) for f in nat_key)
                this_model_source_to_dest_pks[
                    nat_key_to_source_pks[nat_key_vals]
                ] = created_obj.pk


source_to_dest_pks = {}
source_to_dest_pks[User] = {-1: -1}  # PK for AnonymousUser doesn't change
xref_all_users()

# Cross-reference all Assets

source_to_dest_pks[Asset] = {}
source_uids_to_pks = {
    v[1]: v[0]
    for v in Asset.objects.filter(
        owner__username__in=some_usernames
    ).values_list('pk', 'uid')
}
with route_to_dest():
    dest_uids_to_pks = {
        v[1]: v[0]
        for v in Asset.objects.filter(
            owner__username__in=some_usernames
        ).values_list('pk', 'uid')
    }
for uid, dest_pk in dest_uids_to_pks.items():
    try:
        source_to_dest_pks[Asset][source_uids_to_pks[uid]] = dest_pk
    except KeyError:
        pass

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
    UserAssetSubscription.objects.filter(asset__owner__username__in=some_usernames),
    'user',
    all_users_qs,
    fixup=update_asset_pk,
)

copy_related_objs(
    AssetUserPartialPermission.objects.filter(asset__owner__username__in=some_usernames),
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
    ObjectPermission.objects.filter(asset__owner__username__in=some_usernames),
    'user',
    all_users_qs,
    fixup=update_permission_and_asset_pk,
)
