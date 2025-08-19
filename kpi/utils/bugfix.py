# coding: utf-8

import datetime

from django.db import transaction
from formpack.utils.bugfix import repair_file_column_content_in_place

from kpi.models import Asset, AssetVersion


def repair_file_column_content_and_save(asset, include_versions=True) -> bool:
    """
    Given an `Asset`, repair any damage caused to its `content` and the
    `version_content` of all related `AssetVersion`s by
    kobotoolbox/formpack#322, which wrongly transformed the `file` column into
    `media::file` and included it in the list of translated columns.

    Writes only to the `content` (or `version_content`) field for each modified
    model instance.

    Returns `True` if any change was made
    """

    # When was this bug introduced? See formpack commit
    # 443a8e940756976a9f88fb577dbbc53510726536
    BAD_TIME = datetime.datetime(
        2024, 4, 30, 15, 27, 2, tzinfo=datetime.timezone.utc
    )

    any_change = False
    with transaction.atomic():
        # Lock and refetch the latest content to guard against clobbering
        # concurrent updates
        content = (
            Asset.objects.filter(pk=asset.pk, date_modified__gte=BAD_TIME)
            .select_for_update()
            .values('content')
            .first()
        )
        if not content:
            # This asset was not modified recently enough to be affected by
            # this bug
            return False

        if repair_file_column_content_in_place(content):
            Asset.objects.filter(pk=asset.pk).update(content=content)
            any_change = True
            # Also update the in-memory asset instance passed to this function
            asset.content = content

        if not include_versions:
            return any_change

        # Previous versions of the content may need repair, regardless of
        # whether or not the current content did
        for pk, version_content in (
            asset.asset_versions.filter(date_modified__gte=BAD_TIME)
            .select_for_update()
            .values_list('pk', 'version_content')
        ):
            if repair_file_column_content_in_place(version_content):
                AssetVersion.objects.filter(pk=pk).update(
                    version_content=version_content
                )
                any_change = True

        return any_change
