# coding: utf-8
import datetime

from django.db.models import (
    Case,
    DateTimeField,
    F,
    IntegerField,
    Max,
    OuterRef,
    RowRange,
    Subquery,
    Sum,
    Value,
    When,
    Window,
)
from django.db.models.functions import Coalesce
from rest_framework import serializers
from rest_framework.reverse import reverse

from kpi.models import AssetVersion
from kpi.schema_extensions.v2.versions.fields import (
    ContentField,
    ContentHashField,
    DateDeployedField,
    DateModifiedField,
    UidField,
    UrlField,
    VersionNumberField,
)

# A timestamp guaranteed to precede any real `AssetVersion.date_modified`
# value, used as a floor for versions created before the asset's first
# deployment (i.e. when the correlated subquery below finds no prior
# deployment to compare against)
_EPOCH = datetime.datetime(1, 1, 1, tzinfo=datetime.timezone.utc)


class AssetVersionListSerializer(serializers.Serializer):
    # If you change these fields, please update the `only()` and
    # `select_related()` calls  in `AssetVersionViewSet.get_queryset()`
    uid = UidField()
    url = UrlField()
    content_hash = ContentHashField()
    date_deployed = DateDeployedField(read_only=True)
    date_modified = DateModifiedField()
    version_number = VersionNumberField()

    def get_date_deployed(self, obj):
        return obj.deployed and obj.date_modified

    @staticmethod
    def annotate_version_numbers(queryset):
        """
        Annotate every row with `_version_major` and `_version_minor`, computed
        across all the asset's versions in a single query (two window
        functions), so the version number stays consistent while the front end
        paginates: the windows are evaluated before pagination slices the page.

        - `_version_major`: running count of deployments - the major number for
          deployed versions, and the major prefix for undeployed ones.
        - `_version_minor`: for undeployed versions, their position among the
          undeployed versions that follow the most recent deployment (deployed
          rows get `0`, which the serializer ignores).

        The minor window partitions by `_version_group` - the date of the most
        recent deployment at or before each row (a correlated subquery, floored
        to `_EPOCH` before the first deployment). We partition by that instead
        of by `_version_major` because a window function cannot be nested inside
        another window's `PARTITION BY`
        """
        last_deployed_date = (
            AssetVersion.objects.filter(
                asset_id=OuterRef('asset_id'),
                deployed=True,
                date_modified__lte=OuterRef('date_modified'),
            )
            .order_by('-date_modified')
            .values('date_modified')[:1]
        )
        window_order = [F('date_modified').asc(), F('id').asc()]
        running_frame = RowRange(start=None, end=0)
        return queryset.annotate(
            _version_group=Coalesce(
                Subquery(last_deployed_date),
                Value(_EPOCH, output_field=DateTimeField()),
            ),
        ).annotate(
            _version_major=Window(
                expression=Sum(
                    Case(
                        When(deployed=True, then=1),
                        default=0,
                        output_field=IntegerField(),
                    )
                ),
                order_by=window_order,
                frame=running_frame,
            ),
            _version_minor=Window(
                expression=Sum(
                    Case(
                        When(deployed=False, then=1),
                        default=0,
                        output_field=IntegerField(),
                    )
                ),
                partition_by=[F('_version_group')],
                order_by=window_order,
                frame=running_frame,
            ),
        )

    def get_version_number(self, obj):
        """
        Human-readable version number, computed across all the asset's
        versions (not just the current page), so it stays consistent while the
        front end paginates through the list.

        Deployed versions get a major number, e.g. "12": the 1st deployed
        version (chronologically) is "1", the 12th is "12".

        Undeployed versions get a minor number appended to the major number of
        the most recently deployed version that precedes them, e.g. "11.4" is
        the 4th form change made after the 11th deployment. Undeployed versions
        made before any deployment use a major number of "0".

        The numbers are normally supplied for free by `annotate_version_numbers`
        (used by `AssetVersionViewSet.get_queryset()` for the `list` action);
        we only fall back to count queries when the annotations are absent, e.g.
        the `retrieve` action, which serializes a single object.
        """
        major = getattr(obj, '_version_major', None)
        if major is None:
            # Number of deployments up to (and, for a deployed version,
            # including) this version
            major = AssetVersion.objects.filter(
                asset_id=obj.asset_id,
                deployed=True,
                date_modified__lte=obj.date_modified,
            ).count()

        if obj.deployed:
            return str(major)

        minor = getattr(obj, '_version_minor', None)
        if minor is None:
            # Count how many undeployed versions have been made since the last
            # deployment (or since the beginning, if there is no prior one):
            # undeployed versions up to this one, excluding those made on or
            # before the last deployment
            last_deployed_date = (
                AssetVersion.objects.filter(
                    asset_id=obj.asset_id,
                    deployed=True,
                    date_modified__lte=obj.date_modified,
                )
                .values('asset_id')
                .annotate(latest=Max('date_modified'))
                .values('latest')
            )
            minor = AssetVersion.objects.filter(
                asset_id=obj.asset_id,
                deployed=False,
                date_modified__lte=obj.date_modified,
                date_modified__gt=Coalesce(
                    Subquery(last_deployed_date),
                    Value(_EPOCH, output_field=DateTimeField()),
                ),
            ).count()

        return f'{major}.{minor}'

    def get_url(self, obj):
        return reverse(
            'asset-version-detail',
            args=(obj.asset.uid, obj.uid),
            request=self.context.get('request', None),
        )


class AssetVersionSerializer(AssetVersionListSerializer):
    content = ContentField(read_only=True)

    def get_content(self, obj):
        return obj.version_content

    def get_version_id(self, obj):
        return obj.uid

    class Meta:
        model = AssetVersion
        fields = (
                    'version_id',
                    'date_deployed',
                    'date_modified',
                    'content_hash',
                    'content',
                  )
