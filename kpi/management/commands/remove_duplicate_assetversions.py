# coding: utf-8
import json
from collections import defaultdict
from hashlib import md5

from django.core.management.base import BaseCommand
from django.db import transaction

from ...models import Asset, AssetVersion

ROUGH_BATCH_MEM_LIMIT_MB = 100
MAX_BATCH_SIZE = 100


def find_original_and_duplicate_versions(version_pks, asset_pk):
    """
    Given a list of `AssetVersion` primary keys, returns a tuple of:
        * a list of the original `AssetVersion` primary keys;
        * a list of the duplicate primary keys;
        * the batch size used to fetch the versions without memory exhaustion.
    Duplicates are identified by the following method:
        * Remove all `$kuid`s from `version_content['survey']` and
            `version_content['choices']`;
        * Serialize the modified `version_content`, `deployed_content`, `name`,
            `_deployment_data`, and `deployed` to JSON;
        * Calculate the MD5 digest of that JSON;
        * Consider the first `AssetVersion` (ordered by `pk`) with a given MD5
            to be the original, and any subsequent `AssetVersion`s with the
            same MD5 to be duplicates.

    :param version_pks: an iterable of `AssetVersion` primary keys to search
        for duplicates. They MUST all belong to the same `Asset`.
    :param asset_pk: the primary key of the `Asset` to which all versions
        belong. This is required as a safety check.
    """
    version_pks = sorted(version_pks)
    digests_to_first_version_pks = defaultdict(list)

    start = 0
    batch_size = 1
    batch_size_guessed = False

    while True:
        this_batch_version_pks = version_pks[start:start + batch_size]
        if not this_batch_version_pks:
            break
        versions = AssetVersion.objects.filter(
            asset_id=asset_pk,
            pk__in=this_batch_version_pks
        ).order_by('pk')
        for version in versions.iterator():
            for kuid_containing in 'survey', 'choices':
                try:
                    for item in version.version_content[kuid_containing]:
                        try:
                            del item['$kuid']
                        except KeyError:
                            pass
                except KeyError:
                    continue
            serialized = json.dumps((
                version.deployed_content,
                version.name,
                version._deployment_data,  # noqa
                version.version_content,
                version.deployed
            ), sort_keys=True)
            digest = md5(serialized).digest()
            digests_to_first_version_pks[digest].append({
                'pk': version.pk,
                'uid': version.uid,
                })

        start += batch_size

        if not batch_size_guessed:
            batch_size = max(
                1, int(ROUGH_BATCH_MEM_LIMIT_MB * 1024 * 1024 / len(serialized)))
            batch_size = min(batch_size, MAX_BATCH_SIZE)
            batch_size_guessed = True

    duplicates_of = {}
    duplicate_version_pks = []
    for (digest, matches) in digests_to_first_version_pks.items():
        if len(matches) > 1:
            duplicates_of[matches[0]['pk']] = [m['uid'] for m in matches[1:]]
            duplicate_version_pks = duplicate_version_pks + [
                m['pk'] for m in matches[1:]
            ]

    return (
        duplicates_of.keys(),
        duplicate_version_pks,
        duplicates_of,
        batch_size,
    )


class Command(BaseCommand):
    help = (
        'Remove duplicate `AssetVersion`s as identified by their content '
        '(after stripping `$kuid`s). Output is tab-delimited with the '
        'following columns:\n'
        '\tUsername\n\tAsset UID\n\tOriginal Version Count\n'
        '\tDuplicate Version Count\n'
        '\tAsterisk If Deployed Version Is Duplicate\n'
        'The currently deployed version will never be deleted.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            dest='dry_run',
            default=False,
            help='Show information about duplicates but do not remove them'
        )
        parser.add_argument(
            '--username',
            action='store',
            dest='username',
            default=False,
            help='Consider only versions owned by a specific user'
        )
        parser.add_argument(
            '--asset-uid',
            action='store',
            dest='asset_uid',
            default=False,
            help='Consider only versions of the specified `Asset`'
        )

    def handle(self, *args, **options):
        versions = AssetVersion.objects.order_by('pk')
        username = options.get('username')
        if username:
            versions = versions.filter(asset__owner__username=username)
        asset_uid = options.get('asset_uid')
        if asset_uid:
            versions = versions.filter(asset__uid=asset_uid)

        # Trying to get the ORM to annotate each `Asset` with a count of its
        # `AssetVersion`s is unusably slow
        self.stderr.write('Listing versions (may take several seconds)...')
        version_dump = versions.values_list('pk', 'asset_id')
        versions_for_assets = defaultdict(list)
        for version_pk, asset_pk in version_dump:
            versions_for_assets[asset_pk].append(version_pk)
        version_counts_for_assets = {
            asset_pk: len(version_pks) for
                asset_pk, version_pks in versions_for_assets.items()
        }
        # Sort descending by version count; the higher the version count, the
        # more likely many of the versions are duplicates
        assets_sorted_by_version_count = sorted(
            version_counts_for_assets, key=version_counts_for_assets.get,
            reverse=True
        )
        self.stderr.write(
            'Found {} versions for {} assets; '
            'maximum {} versions per asset'.format(
                len(version_dump),
                len(versions_for_assets),
                version_counts_for_assets[assets_sorted_by_version_count[0]]
            )
        )

        for asset_pk in assets_sorted_by_version_count:
            with transaction.atomic():
                asset_values = Asset.objects.filter(
                    pk=asset_pk
                ).values_list('owner__username', 'uid', '_deployment_data')
                if not asset_values:
                    # Asset with this PK disappeared before we got to it
                    continue
                username, uid, deployment_data = asset_values[0]

                # Find the currently deployed version; we'll never delete it
                # even if it's a duplicate
                currently_deployed_uid = json.loads(deployment_data).get(
                    'version', None)
                currently_deployed_pk = AssetVersion.objects.filter(
                    uid=currently_deployed_uid).values_list('pk', flat=True)

                original_version_pks, duplicate_version_pks, duplicate_uids, \
                    batch_size = find_original_and_duplicate_versions(
                        versions_for_assets[asset_pk], asset_pk)
                pks_to_delete = duplicate_version_pks

                currently_deployed_is_duplicate = False
                if currently_deployed_pk:
                    try:
                        # Don't delete the currently deployed version
                        pks_to_delete.remove(currently_deployed_pk[0])
                    except ValueError:
                        pass
                    else:
                        currently_deployed_is_duplicate = True

                output = (
                    username,
                    uid,
                    len(original_version_pks),
                    len(duplicate_version_pks),
                    '*' if currently_deployed_is_duplicate else ''
                )
                self.stdout.write(('{}\t' * len(output)).format(*output))

                if not options.get('dry_run'):
                    # Store the UIDs of all duplicate versions in the original
                    # version's `uid_aliases` field
                    for pk, new_uid_aliases in duplicate_uids.items():
                        version_qs = AssetVersion.objects.filter(pk=pk)
                        uid_aliases = version_qs.values_list(
                            'uid_aliases', flat=True)[0]
                        if not uid_aliases:
                            uid_aliases = new_uid_aliases
                        else:
                            uid_aliases.extend(new_uid_aliases)
                        version_qs.update(uid_aliases=uid_aliases)
                    # Haha, silly programmer: you thought you could delete all
                    # these versions at once without memory exhaustion?!
                    # There are FKs (e.g. from `AssetSnapshot`) that require
                    # Django to take the slow path for cascade deletion
                    start = 0
                    while True:
                        this_batch_version_pks = pks_to_delete[
                            start:start + batch_size]
                        if not this_batch_version_pks:
                            break
                        AssetVersion.objects.filter(
                            pk__in=this_batch_version_pks
                        ).delete()
                        start += batch_size
