"""
Usage:
  python manage.py runscript repop_known_cols --script-args=<assetUid>
"""

import json

from django.core.paginator import Paginator

from kobo.apps.subsequences.models import SubmissionExtras
from kobo.apps.subsequences.utils.deprecation import (
    get_sanitized_dict_keys,
    get_sanitized_known_columns,
)
from kobo.apps.subsequences.utils.determine_export_cols_with_values import (
    determine_export_cols_with_values,
)
from kpi.models.asset import Asset


def migrate_subex_content(
    sub_ex: SubmissionExtras, asset: Asset, save=True
) -> SubmissionExtras:
    content_string = json.dumps(sub_ex.content)
    if '"translated"' in content_string:  # migration
        content_string = content_string.replace(
            '"translated"', '"translation"'
        )  # migration
        sub_ex.content = json.loads(content_string)
        if content := get_sanitized_dict_keys(sub_ex.content, asset):
            sub_ex.content = content
        print('submission_extra has old content')
        if save:
            sub_ex.save()
        return sub_ex


def migrate_subex_content_for_asset(asset, save=True):
    submission_extras = []
    for sub_ex in asset.submission_extras.all():
        if updated_sub_ex := migrate_subex_content(sub_ex, asset=asset, save=save):
            submission_extras.append(updated_sub_ex)

    return submission_extras


def repop_asset_known_cols(asset, save=True):
    print(f'for_asset: {asset.uid}')
    print('  before:')
    print('   - ' + '\n   - '.join(sorted(asset.known_cols)))
    known_cols = determine_export_cols_with_values(asset.submission_extras.all())
    asset.known_cols = get_sanitized_known_columns(asset)
    if 'translated' in asset.advanced_features:  # migration
        asset.advanced_features['translation'] = asset.advanced_features['translated']
        del asset.advanced_features['translated']
    if save:
        asset.save(create_version=False)
    print('  after:')
    print('   - ' + '\n   - '.join(sorted(known_cols)))


def migrate_advanced_features(asset, save=True):
    if 'translated' in asset.advanced_features:  # migration
        asset.advanced_features['translation'] = asset.advanced_features['translated']
        if save:
            asset.save(create_version=False)


def run(asset_uid=None):

    if asset_uid == '!':
        SubmissionExtras.objects.all().delete()
        for asset in Asset.objects.exclude(advanced_features__exact={}).iterator():
            asset.advanced_features = {}
            asset.save(create_version=False)
            repop_asset_known_cols(asset)
        print('Note:\nRemoved all transcript+translation related data from all assets')
    elif asset_uid is None:

        page_size = 2000
        paginator = Paginator(
            Asset.objects.only(
                'id',
                'uid',
                'content',
                'advanced_features',
                'known_cols',
                'summary',
                'asset_type',
            )
            .prefetch_related('submission_extras')
            .exclude(advanced_features__exact={})
            .order_by('pk'),
            page_size,
        )

        for page in paginator.page_range:
            assets = paginator.page(page).object_list
            updated_assets = []
            updated_submission_extras = []
            for asset in assets:
                print(f'Processing asset {asset.uid}')
                migrate_advanced_features(asset, save=False)
                updated_submission_extras.extend(
                    migrate_subex_content_for_asset(asset, save=False)
                )
                repop_asset_known_cols(asset, save=False)
                asset.adjust_content_on_save()
                asset.validate_advanced_features()
                updated_assets.append(asset)

            if updated_assets:
                Asset.objects.bulk_update(
                    updated_assets,
                    ['content', 'advanced_features', 'known_cols'],
                )

            if updated_submission_extras:
                SubmissionExtras.objects.bulk_update(
                    updated_submission_extras, ['content']
                )
    else:
        asset = Asset.objects.get(uid=asset_uid)
        migrate_subex_content_for_asset(asset)
        repop_asset_known_cols(asset)
