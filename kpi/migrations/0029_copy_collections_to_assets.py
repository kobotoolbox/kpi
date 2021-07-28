import sys
from collections import defaultdict

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

import kpi.fields.kpi_uid
from kpi.utils.models import disable_auto_field_update


def migrate_collections_to_assets(apps, schema_editor):
    Asset = apps.get_model('kpi', 'Asset')
    UserAssetSubscription = apps.get_model('kpi', 'UserAssetSubscription')
    Collection = apps.get_model('kpi', 'Collection')
    ContentType = apps.get_model('contenttypes', 'ContentType')
    ObjectPermission = apps.get_model('kpi', 'ObjectPermission')
    Permission = apps.get_model('auth', 'Permission')
    TaggedItem = apps.get_model('taggit', 'TaggedItem')
    UserCollectionSubscription = apps.get_model(
        'kpi', 'UserCollectionSubscription'
    )

    asset_ct = ContentType.objects.get(app_label='kpi', model='asset')
    try:
        collection_ct = ContentType.objects.get(app_label='kpi', model='collection')
    except ContentType.DoesNotExist:
        collection_ct = None
    if not Collection.objects.exists():
        # There's no work for us to do.
        return
    if not collection_ct:
        raise RuntimeError(
            'The database contains collections but no content type for them.'
        )

    def get_perm_pk(codename):
        return Permission.objects.get(codename=codename).pk

    perm_map = {
        get_perm_pk('view_collection'): get_perm_pk('view_asset'),
        get_perm_pk('change_collection'): get_perm_pk('change_asset'),
    }

    # django won't automatically make new permissions until after migrations
    # complete
    try:
        discover_asset_pk = get_perm_pk('discover_asset')
    except Permission.DoesNotExist:
        # this seems less awful than using django's private innards (i'm
        # looking at you, django.contrib.auth.management.create_permissions)
        discover_asset_pk = Permission.objects.create(
            codename='discover_asset',
            content_type_id=asset_ct.pk,
            name='Can discover asset in public lists',
        ).pk
    view_collection_pk = get_perm_pk('view_collection')

    # store the pk of the new asset created for each collection. we'll need
    # this when handling parents and subscriptions.
    collection_pks_to_asset_pks = {
        # collection pk: new asset pk
    }

    def create_asset_from_collection(collection):
        """
        migrate a collection to an asset, returning the new asset's pk. does
        NOT deal with parents or subscriptions
        """
        assert collection.pk not in collection_pks_to_asset_pks

        asset = Asset()
        asset.asset_type = 'collection'

        # easy copy operations
        for attr in [
            'name',
            'owner',
            'date_created',
            'date_modified',
        ]:
            setattr(asset, attr, getattr(collection, attr))

        # for nested collections--do any exist, given that there's no support
        # in the ui?--just copy the parent collection id for now. it'll be
        # replaced with the appropriate asset id later. note that
        # `asset.parent` must be used here instead of `asset.parent_id` because
        # we've temporarily altered parent to be a simple integer field instead
        # of a foreign key
        asset.parent = collection.parent_id

        # write to database now so we can create m2m relationships
        with disable_auto_field_update(Asset, 'date_created'):
            with disable_auto_field_update(Asset, 'date_modified'):
                Asset.objects.bulk_create([asset])  # avoid save() shenanigans
        collection_pks_to_asset_pks[collection.pk] = asset.pk

        # copy permissions
        old_perms = ObjectPermission.objects.filter(
            content_type=collection_ct, object_id=collection.pk
        )
        new_perms = []
        for collection_perm in old_perms:
            asset_perm = ObjectPermission()
            asset_perm.content_type = asset_ct
            asset_perm.object_id = asset.pk
            asset_perm.permission_id = perm_map[collection_perm.permission_id]
            for attr in ['user_id', 'deny', 'inherited']:
                setattr(asset_perm, attr, getattr(collection_perm, attr))
            new_perms.append(asset_perm)

            # "public" for a collection meant having both `view_collection`
            # assigned to the anonymous user *and* `discoverable_when_public`
            # set to `True`
            if (
                collection_perm.permission_id == view_collection_pk
                and collection_perm.user_id == settings.ANONYMOUS_USER_ID
                and not collection_perm.deny
            ):
                # `discover_asset` replaces `discoverable_when_public`
                asset_perm = ObjectPermission()
                asset_perm.content_type = asset_ct
                asset_perm.object_id = asset.pk
                asset_perm.permission_id = discover_asset_pk
                asset_perm.user_id = settings.ANONYMOUS_USER_ID
                asset_perm.inherited = collection_perm.inherited
                asset_perm.save()
        ObjectPermission.objects.bulk_create(new_perms)
        old_perms.delete()

        # update all tag assignments in place
        TaggedItem.objects.filter(
            content_type=collection_ct, object_id=collection.pk
        ).update(content_type=asset_ct, object_id=asset.pk)

        return asset.pk

    # create new assets for all collections
    done = 0
    for collection in Collection.objects.iterator():
        asset_pk = create_asset_from_collection(collection)
        done += 1
        if done % 100 == 0:
            sys.stdout.write(f'{done} ')
            sys.stdout.flush()

    # create new asset subscriptions for all collection subscriptions, pointing
    # at the new assets we just created
    for (
        collection_subscription
    ) in UserCollectionSubscription.objects.iterator():
        asset_subscription = UserAssetSubscription()
        asset_subscription.user_id = collection_subscription.user_id
        asset_subscription.asset_id = collection_pks_to_asset_pks[
            collection_subscription.collection_id
        ]
        asset_subscription.save()

    # update all parent assignments to use the new assets we just created. at
    # this point, `parent` is just an integer field and cannot be accessed as
    # `parent_id`
    children_of_parent_asset = defaultdict(list)
    for pk, parent in Asset.objects.exclude(parent=None).values_list(
        'pk', 'parent'
    ):
        children_of_parent_asset[
            collection_pks_to_asset_pks[parent]
        ].append(pk)
    for parent, children in children_of_parent_asset.items():
        Asset.objects.filter(pk__in=children).update(parent=parent)


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0028_assign_manage_asset_permissions'),
    ]

    operations = [
        migrations.CreateModel(
            name='UserAssetSubscription',
            fields=[
                (
                    'id',
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID',
                    ),
                ),
                ('uid', kpi.fields.kpi_uid.KpiUidField(uid_prefix='b')),
            ],
        ),
        migrations.AddField(
            model_name='userassetsubscription',
            name='asset',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE, to='kpi.Asset'
            ),
        ),
        migrations.AddField(
            model_name='userassetsubscription',
            name='user',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterUniqueTogether(
            name='userassetsubscription', unique_together={('asset', 'user')},
        ),
        migrations.AlterField(
            model_name='asset',
            name='asset_type',
            field=models.CharField(
                choices=[
                    ('text', 'text'),
                    ('empty', 'empty'),
                    ('question', 'question'),
                    ('block', 'block'),
                    ('survey', 'survey'),
                    ('template', 'template'),
                    ('collection', 'collection'),
                ],
                default='survey',
                max_length=20,
            ),
        ),
        # cope with constraint madness by *temporarily* changing the asset
        # parent field from a foreign key to a simple integer field. the next
        # migration resets it to a foreign key again (but pointing at the asset
        # model itself instead of the collection model)
        migrations.AlterField(
            model_name='asset',
            name='parent',
            field=models.IntegerField(
                blank=True,
                null=True,
                db_column='parent_id',
            ),
        ),
        migrations.AlterModelOptions(
            name='asset',
            options={
                'default_permissions': ('add', 'change', 'delete'),
                'ordering': ('-date_modified',),
                'permissions': (
                    ('view_asset', 'Can view asset'),
                    ('share_asset', "Can change asset's sharing settings"),
                    ('discover_asset', 'Can discover asset in public lists'),
                    ('add_submissions', 'Can submit data to asset'),
                    ('view_submissions', 'Can view submitted data for asset'),
                    (
                        'partial_submissions',
                        'Can make partial actions on submitted data for asset for specific users',
                    ),
                    (
                        'change_submissions',
                        'Can modify submitted data for asset',
                    ),
                    (
                        'delete_submissions',
                        'Can delete submitted data for asset',
                    ),
                    (
                        'share_submissions',
                        "Can change sharing settings for asset's submitted data",
                    ),
                    (
                        'validate_submissions',
                        'Can validate submitted data asset',
                    ),
                    ('from_kc_only', 'INTERNAL USE ONLY; DO NOT ASSIGN'),
                ),
            },
        ),
        migrations.RunPython(migrate_collections_to_assets),
    ]
