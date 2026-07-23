# coding: utf-8
import datetime

from django.db.models import (
    Case,
    Count,
    DateTimeField,
    F,
    IntegerField,
    OuterRef,
    Q,
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

    # Version numbering:
    # Each version gets a label like "12" (a deployment) or "11.4" (the 4th
    # undeployed form change made after the 11th deployment). The numbers span
    # the asset's whole history, so the front end can't derive them while
    # paginating - the API computes them. In plain terms:
    #
    #   - major = a correlated SUBQUERY. It reads the full history through
    #     `OuterRef`, so it stays correct even when the outer query is trimmed -
    #     by a `?deployed=` filter, or down to one row for `retrieve`.
    #   - minor = a WINDOW. A running count has to see the sibling rows around
    #     each version, so it's computed over the whole list page at once.
    #   - retrieve = falls back to a count query for the minor number, because a
    #     single serialized object has no sibling rows for a window to run over
    #     (filtering is not the reason - the minor window is fine under
    #     `?deployed=`; see `test_version_number_with_deployed_filter`).
    #
    # Versions are ordered chronologically, breaking ties on `id` so the order
    # is total and deterministic. `_at_or_before(date_modified, id)` matches
    # every version at or before that position
    @staticmethod
    def _at_or_before(date_modified, id_):
        return Q(date_modified__lt=date_modified) | Q(
            date_modified=date_modified, id__lte=id_
        )

    @classmethod
    def _major_subquery(cls):
        """
        Correlated subquery: the number of deployments at or before each row,
        in `(date_modified, id)` order - i.e. the row's major number (for a
        deployed row, it counts itself)

        This references the asset's full version history through `OuterRef`,
        so it is unaffected by an outer `?deployed=` filter or by narrowing the
        queryset to a single object (the `retrieve` action). Using it in both
        the list and retrieve paths guarantees they report the same number.
        """
        deployments = (
            AssetVersion.objects.filter(
                asset_id=OuterRef('asset_id'), deployed=True
            )
            .filter(cls._at_or_before(OuterRef('date_modified'), OuterRef('id')))
            .order_by()
            .values('asset_id')
            .annotate(count=Count('id'))
            .values('count')
        )
        return Coalesce(Subquery(deployments), 0)

    @classmethod
    def annotate_major_number(cls, queryset):
        """
        Annotate `_version_major` (see `_major_subquery`). Safe for any action,
        including `retrieve`, since it is a filter-independent subquery
        """
        return queryset.annotate(_version_major=cls._major_subquery())

    @classmethod
    def annotate_version_numbers(cls, queryset):
        """
        Annotate every row with `_version_major` and `_version_minor`, computed
        across all the asset's versions in a single query, so the version
        number stays consistent while the front end paginates: everything is
        evaluated before pagination slices the page.

        - `_version_major`: see `_major_subquery`.
        - `_version_minor`: for undeployed versions, their position among the
          undeployed versions that follow the most recent deployment (deployed
          rows get `0`, which the serializer ignores). It is a running count
          (window) partitioned by `_version_group` - the date of the most
          recent deployment at or before each row (a correlated subquery,
          floored to `_EPOCH` before the first deployment). We partition by that
          date rather than by `_version_major` because a window function cannot
          be nested inside another window's `PARTITION BY`.

        `_version_minor` is a window, so it needs the sibling rows of a full
        list page (a `?deployed=` filter is fine — it still sees every row it
        needs to count). The `retrieve` action, which serializes a single
        object with no siblings, must instead use `_minor_fallback`.
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
        return cls.annotate_major_number(queryset).annotate(
            _version_group=Coalesce(
                Subquery(last_deployed_date),
                Value(_EPOCH, output_field=DateTimeField()),
            ),
        ).annotate(
            _version_minor=Window(
                expression=Sum(
                    Case(
                        When(deployed=False, then=1),
                        default=0,
                        output_field=IntegerField(),
                    )
                ),
                partition_by=[F('_version_group')],
                order_by=[F('date_modified').asc(), F('id').asc()],
                frame=RowRange(start=None, end=0),
            ),
        )

    @classmethod
    def _minor_fallback(cls, obj):
        """
        Count how many undeployed versions have been made since the deployment
        that precedes `obj` (or since the beginning, if there is none). Mirrors
        the `_version_minor` window - same `(date_modified, id)` ordering - so a
        version gets the same minor number whether it is served by `list` or
        `retrieve`, even when timestamps are tied
        """
        last_deployed_date = (
            AssetVersion.objects.filter(
                asset_id=obj.asset_id,
                deployed=True,
                date_modified__lte=obj.date_modified,
            )
            .order_by('-date_modified')
            .values_list('date_modified', flat=True)
            .first()
        )
        undeployed = AssetVersion.objects.filter(
            asset_id=obj.asset_id, deployed=False
        ).filter(cls._at_or_before(obj.date_modified, obj.id))
        if last_deployed_date is not None:
            undeployed = undeployed.filter(
                date_modified__gte=last_deployed_date
            )
        return undeployed.count()

    def get_version_number(self, obj):
        """
        Human-readable version number, computed across all the asset's
        versions (not just the current page), so it stays consistent while the
        front end paginates through the list

        Deployed versions get a major number, e.g. "12": the 1st deployed
        version (chronologically) is "1", the 12th is "12".

        Undeployed versions get a minor number appended to the major number of
        the most recently deployed version that precedes them, e.g. "11.4" is
        the 4th form change made after the 11th deployment. Undeployed versions
        made before any deployment use a major number of "0".

        The numbers are normally supplied by the annotations added in
        `AssetVersionViewSet.get_queryset()`. The major number is always
        annotated (`_version_major`); the minor number is annotated for the
        `list` action and falls back to `_minor_fallback` otherwise (e.g. the
        `retrieve` action, which serializes a single object).
        """
        major = getattr(obj, '_version_major', None)
        if major is None:
            # Defensive: the serializer is used without the annotation. Count
            # deployments the same way `_major_subquery` does
            major = (
                AssetVersion.objects.filter(
                    asset_id=obj.asset_id, deployed=True
                )
                .filter(self._at_or_before(obj.date_modified, obj.id))
                .count()
            )

        if obj.deployed:
            return str(major)

        minor = getattr(obj, '_version_minor', None)
        if minor is None:
            minor = self._minor_fallback(obj)

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
