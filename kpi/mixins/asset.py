from collections import defaultdict

from django.conf import settings
from django.contrib.postgres.aggregates import BoolOr
from django.db.models import BooleanField, ExpressionWrapper, F, Prefetch, Q

from kobo.apps.openrosa.apps.logger.models.xform import XForm
from kobo.apps.organizations.models import Organization
from kpi.models.asset import Asset
from kpi.models.object_permission import ObjectPermission


class AssetViewSetListMixin:

    # Ids of the assets of the page and uids of the deployed ones, set by
    # `_cache_asset_ids()`
    _asset_ids = None
    _asset_uids = None

    def get_organizations_per_asset_ids(self, asset_ids: list) -> dict:

        assets = (
            Asset.objects.only('owner', 'uid', 'name')
            .filter(id__in=asset_ids)
            .select_related('owner')
            .prefetch_related(
                Prefetch(
                    'owner__organizations_organization',
                    queryset=Organization.objects.all()
                    .select_related('owner__organization_user__user')
                    .order_by('-organization_users__created'),
                    to_attr='organizations',
                )
            )
        )
        organizations_per_asset = defaultdict(dict)
        for asset in assets:
            try:
                organizations_per_asset[asset.id] = asset.owner.organizations[0]
            except IndexError:
                pass

        return organizations_per_asset

    def get_mmo_organization_ids(self, organizations_per_asset: dict) -> set[str]:
        """
        Return the ids of the multi-member organizations of the page, so that the
        serializer does not run one query per organization
        """

        organizations = {
            organization.id: organization
            for organization in organizations_per_asset.values()
        }
        return Organization.get_mmo_ids(list(organizations.values()))

    def get_shared_asset_ids(self, asset_ids: list) -> tuple[set[int], set[int]]:
        """
        Return, with one query:
        - the ids of the assets that grant a permission to anyone but their
          owner, the anonymous user included, which `get_status()` reports as
          shared unless they are public;
        - among them, the ids of the assets shared with a user other than the
          anonymous one, which `get_access_types()` needs.
        """

        records = (
            ObjectPermission.objects.filter(
                asset_id__in=asset_ids,
                deny=False,
            )
            .exclude(
                user_id=F('asset__owner_id'),
            )
            .values('asset_id')
            .annotate(
                shared_with_user=BoolOr(
                    ExpressionWrapper(
                        ~Q(user_id=settings.ANONYMOUS_USER_ID),
                        output_field=BooleanField(),
                    )
                )
            )
            .order_by()
        )

        permission_asset_ids = set()
        user_shared_asset_ids = set()
        for record in records:
            permission_asset_ids.add(record['asset_id'])
            if record['shared_with_user']:
                user_shared_asset_ids.add(record['asset_id'])

        return permission_asset_ids, user_shared_asset_ids

    def _attach_xforms_to_assets(self, assets: list):
        """
        Attach the related XForm to each Asset and yield it, so that this happens
        in the same pass as serialization.

        It reads the uids that `_cache_asset_ids()` collected. Only the serializer
        must consume the result: any earlier iteration would leave it empty.
        """

        xform_qs = (
            XForm.all_objects.filter(kpi_asset_uid__in=self._asset_uids)
            .only(
                'id_string',
                'num_of_submissions',
                'attachment_storage_bytes',
                'require_auth',
                'uuid',
                'mongo_uuid',
                'encrypted',
                'last_submission_time',
                'kpi_asset_uid',
            )
            .order_by()
        )

        xforms_by_uid = {xf.kpi_asset_uid: xf for xf in xform_qs}

        # Single pass over assets: attach _xform then yield
        for asset in assets:
            if asset.has_deployment:
                if xf := xforms_by_uid.get(asset.uid):
                    xf.user = asset.owner
                    asset.deployment._xform = xf
                else:
                    # If XForm does not exist, something went wrong.
                    # Consider the asset as not deployed.
                    asset.date_deployed = None
                    asset._deployment_data = {}
            yield asset

    def _cache_asset_ids(self, assets: list):
        """
        Collect the ids of the assets of the page, and the uids of the deployed
        ones, in a single loop
        """

        self._asset_ids = []
        self._asset_uids = []
        for asset in assets:
            self._asset_ids.append(asset.pk)
            # Only deployed assets have an XForm. Leaving the others out keeps the
            # XForm query small, and skips it when no asset of the page is deployed.
            if asset.has_deployment:
                self._asset_uids.append(asset.uid)
