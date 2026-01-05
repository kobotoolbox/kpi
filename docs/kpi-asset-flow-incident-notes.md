# KPI Asset Listing & Deployment Flow (Incident-Focused)

## Scope

This document explains how the KPI API serves asset lists and handles
(deploy/redeploy) form deployments, then maps those flows to the incident
symptoms reported for orphaned organization data. Code references point to
backend files in this repository.

## Asset listing: user flow and call chain

### Entry points (routing)

* **Global assets list**: `GET /api/v2/assets/`
  * Registered in `kpi/urls/router_api_v2.py` via `AssetViewSet`.
* **Organization-scoped assets list**: `GET /api/v2/organizations/{uid}/assets/`
  * Registered in `kpi/urls/router_api_v2.py` via `OrganizationViewSet` and
    `OrganizationAssetViewSet` in `kobo/apps/organizations/views.py`.

### AssetViewSet list flow

`AssetViewSet` is the primary entry point for asset listing and uses a
multi-stage pipeline:

1. **Queryset and filtering**
   * `AssetViewSet` applies `ExcludeOrgAssetFilter`,
     `KpiObjectPermissionsFilter`, `SearchFilter`, and `AssetOrderingFilter` to
     scope assets to what the requesting user can see.
   * The list path uses `get_queryset()` and then calls
     `optimize_queryset_for_list()` for list-specific DB tuning.
   * Code: `kpi/views/v2/asset.py` (`AssetViewSet` class, `get_queryset`,
     `filter_backends`).

2. **Pagination and caching for serializers**
   * `list()` caches asset IDs and UIDs for the page, then loads
     per-asset context to avoid per-row queries.
   * Code: `kpi/views/v2/asset.py` (`list` and `get_serializer_context`).

3. **Context enrichment for serializer**
   * The list view constructs per-asset caches for:
     * object permissions (`cache_all_assets_perms`),
     * user subscriptions (`UserAssetSubscription`),
     * children counts, and
     * **organizations per asset** via
       `AssetViewSetListMixin.get_organizations_per_asset_ids()`.
   * Code: `kpi/views/v2/asset.py` (`get_serializer_context`) and
     `kpi/mixins/asset.py` (`get_organizations_per_asset_ids`).

4. **Serialization**
   * The list endpoint uses `AssetListSerializer`.
   * Serializer methods determine **access types** and **owner label**. These
     methods read from `organizations_per_asset` (or `organization` in
     org-scoped lists) and then call `organization.get_user_role()`.
   * Code: `kpi/serializers/v2/asset.py` (`get_access_types`, `get_owner_label`).

### Organization-scoped list flow

* `OrganizationViewSet.assets()` validates permissions by calling
  `OrganizationViewSet.get_object()` and then forwards the request to
  `OrganizationAssetViewSet`.
* `OrganizationAssetViewSet.get_queryset()` uses the resolved organization to
  filter assets to those owned by the organization owner.
* Code: `kobo/apps/organizations/views.py` (`OrganizationViewSet.assets`,
  `OrganizationAssetViewSet`).

### User organization lookup

When the front end resolves the current user, `CurrentUserSerializer` populates
`organization` using `user.organization`:

* `CurrentUserSerializer.get_organization()` reads the `User.organization`
  property to generate the organization URL/name/UID tuple.
* `User.organization` (in `kobo/apps/kobo_auth/models.py`) looks up the newest
  organization for the user and can create a default organization if none
  exists and the user is active.

These are distinct from the asset list context handling above (which uses
prefetches on the M2M relation).

## Deploying and redeploying forms

### API endpoints

`AssetViewSet.deployment()` provides the deployment lifecycle for a single
asset:

* **GET** `/api/v2/assets/{uid}/deployment/` — read deployment state.
* **POST** `/api/v2/assets/{uid}/deployment/` — create a deployment.
* **PATCH** `/api/v2/assets/{uid}/deployment/` — redeploy or set active state.

Code: `kpi/views/v2/asset.py` (`deployment` action).

### Deployment serializer behavior

`DeploymentSerializer` orchestrates creation vs. redeploy:

* **Create** (`POST`): calls `asset.deploy(...)` after validating version.
* **Update** (`PATCH`):
  * If only `active` is changing, it toggles deployment activity without a
    redeploy.
  * Otherwise, it calls `asset.deploy(...)` again to redeploy the latest
    version.

Code: `kpi/serializers/v2/deployment.py` (`create`, `update`).

### DeployableMixin and backend

`DeployableMixin` in `kpi/deployment_backends/mixin.py` handles the actual
workflow:

1. `deploy()` chooses **connect + deploy** vs. **redeploy** based on whether
   the asset already has deployment data.
2. It marks the latest version as deployed and updates `date_deployed`.
3. It triggers async media file synchronization.

Actual backend-specific behavior (e.g., OpenRosa/KoboCAT) is implemented in the
backend class (see `kpi/deployment_backends/openrosa_backend.py`, notably
`redeploy`).

## Why asset listing can fail under the incident conditions

### The crash point

In the incident description, users whose data includes a broken organization
reference trigger a 500 when listing assets. The most plausible crash path
based on current code is:

1. The list view builds `organizations_per_asset` using
   `AssetViewSetListMixin.get_organizations_per_asset_ids()`.
2. If the underlying organization record is missing or the join data is
   corrupt, `organizations_per_asset` may not contain an entry for some assets
   (or the entry is `None`).
3. `AssetListSerializer.get_access_types()` unconditionally calls
   `organization.get_user_role(request.user)`. If `organization` is `None`, this
   becomes an `AttributeError`, which bubbles up as a 500 and may crash the
   worker process if uncaught.

Code paths involved:

* `kpi/mixins/asset.py` — organization prefetch for assets.
* `kpi/views/v2/asset.py` — context construction for lists.
* `kpi/serializers/v2/asset.py` — `get_access_types()` uses
  `organization.get_user_role(...)` without a `None` guard.

### Why the organization detail endpoint may differ

* `GET /api/v2/organizations/{uid}/` is handled by `OrganizationViewSet` and
  filters the queryset to organizations containing the user.
* If the org record is missing or the user is not attached, the view should
  return **404**, not 500, because it simply can't locate the object.

Code: `kobo/apps/organizations/views.py` (`OrganizationViewSet.get_queryset`).

### Likely data issue that triggers the crash

The failure described in the incident (a broken organization UID attached to a
user) aligns with a **corrupted organization membership link** in the
`OrganizationUser` join table or related data. If a user has a membership row
that references a missing organization, the M2M prefetch used by asset listing
will fail to populate `organizations_per_asset`, leaving `organization` as
`None` in the serializer.

Once that `None` reaches `get_access_types()`, the serializer raises an
`AttributeError`, leading to the 500 error observed in production logs.

## Remediation guidance (aligned with the incident)

### Data repair

* Identify users whose organization membership points at a missing
  organization ID. Remove or repair the invalid membership row so the user has
  either:
  * a valid organization membership, or
  * no membership (allowing `User.organization` to create a default org on
    demand).

Relevant model and relation:

* `Organization` / `OrganizationUser` relationship in
  `kobo/apps/organizations/models.py`.

### Defensive code change (optional hardening)

To guard against future corrupt data, consider adding a `None` check in
`AssetListSerializer.get_access_types()` before calling
`organization.get_user_role(...)`. That would make asset listing resilient even
when the org reference is missing.

Code to adjust:

* `kpi/serializers/v2/asset.py` (`get_access_types`).

---

If you want this document expanded with front-end request flow or specific SQL
queries for the cleanup, call that out and I can add those details.
