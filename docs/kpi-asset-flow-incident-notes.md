# KPI Asset Listing & Deployment Flow (Incident-Focused)

## Scope

This document explains how the KPI API serves asset lists and handles (deploy/redeploy) form deployments, then maps those flows to the incident symptoms reported for orphaned organization data. Code references point to backend files in this repository.

## Asset listing: user flow and call chain

### Entry points (routing)

* **Global assets list**: `GET /api/v2/assets/`
  * Registered in `kpi/urls/router_api_v2.py` via `AssetViewSet`.
* **Organization-scoped assets list**: `GET /api/v2/organizations/{uid}/assets/`
  * Registered in `kpi/urls/router_api_v2.py` via `OrganizationViewSet` and `OrganizationAssetViewSet` in `kobo/apps/organizations/views.py`.

### Front-end request flow (projects list)

The projects UI issues a global assets query to render the list view:

1. **Page load** (`/#/projects/home` in the single-page app) triggers the projects list fetch.
2. **API request**: `GET /api/v2/assets/?q=asset_type:survey&limit=...` (and variations with filters) is sent to the KPI API.
3. **Failure behavior**: if this request returns 500, the UI shows “failed to list assets” and the projects list remains empty.

This is consistent with the error reports for the `communityvoices` account, where the same request returns 500 even though the organization detail endpoint works.

### AssetViewSet list flow

`AssetViewSet` is the primary entry point for asset listing and uses a multi-stage pipeline:

1. **Queryset and filtering**
   * `AssetViewSet` applies `ExcludeOrgAssetFilter`, `KpiObjectPermissionsFilter`, `SearchFilter`, and `AssetOrderingFilter` to scope assets to what the requesting user can see.
   * The list path uses `get_queryset()` and then calls `optimize_queryset_for_list()` for list-specific DB tuning.
   * Code: `kpi/views/v2/asset.py` (`AssetViewSet` class, `get_queryset`, `filter_backends`).

2. **Pagination and caching for serializers**
   * `list()` caches asset IDs and UIDs for the page, then loads per-asset context to avoid per-row queries.
   * Code: `kpi/views/v2/asset.py` (`list` and `get_serializer_context`).

3. **Context enrichment for serializer**
   * The list view constructs per-asset caches for:
     * object permissions (`cache_all_assets_perms`),
     * user subscriptions (`UserAssetSubscription`),
     * children counts, and
     * **organizations per asset** via `AssetViewSetListMixin.get_organizations_per_asset_ids()`.
   * Code: `kpi/views/v2/asset.py` (`get_serializer_context`) and `kpi/mixins/asset.py` (`get_organizations_per_asset_ids`).

4. **Serialization**
   * The list endpoint uses `AssetListSerializer`.
   * Serializer methods determine **access types** and **owner label**. These methods read from `organizations_per_asset` (or `organization` in org-scoped lists) and then call `organization.get_user_role()`.
   * Code: `kpi/serializers/v2/asset.py` (`get_access_types`, `get_owner_label`).

### Organization-scoped list flow

* `OrganizationViewSet.assets()` validates permissions by calling `OrganizationViewSet.get_object()` and then forwards the request to `OrganizationAssetViewSet`.
* `OrganizationAssetViewSet.get_queryset()` uses the resolved organization to filter assets to those owned by the organization owner.
* Code: `kobo/apps/organizations/views.py` (`OrganizationViewSet.assets`, `OrganizationAssetViewSet`).

### User organization lookup

When the front end resolves the current user, `CurrentUserSerializer` populates `organization` using `user.organization`:

* `CurrentUserSerializer.get_organization()` reads the `User.organization` property to generate the organization URL/name/UID tuple.
* `User.organization` (in `kobo/apps/kobo_auth/models.py`) looks up the newest organization for the user and can create a default organization if none exists and the user is active.

These are distinct from the asset list context handling above (which uses prefetches on the M2M relation).

## Deploying and redeploying forms

### API endpoints

`AssetViewSet.deployment()` provides the deployment lifecycle for a single asset:

* **GET** `/api/v2/assets/{uid}/deployment/` — read deployment state.
* **POST** `/api/v2/assets/{uid}/deployment/` — create a deployment.
* **PATCH** `/api/v2/assets/{uid}/deployment/` — redeploy or set active state.

Code: `kpi/views/v2/asset.py` (`deployment` action).

### Deployment serializer behavior

`DeploymentSerializer` orchestrates creation vs. redeploy:

* **Create** (`POST`): calls `asset.deploy(...)` after validating version.
* **Update** (`PATCH`):
  * If only `active` is changing, it toggles deployment activity without a redeploy.
  * Otherwise, it calls `asset.deploy(...)` again to redeploy the latest version.

Code: `kpi/serializers/v2/deployment.py` (`create`, `update`).

### DeployableMixin and backend

`DeployableMixin` in `kpi/deployment_backends/mixin.py` handles the actual workflow:

1. `deploy()` chooses **connect + deploy** vs. **redeploy** based on whether the asset already has deployment data.
2. It marks the latest version as deployed and updates `date_deployed`.
3. It triggers async media file synchronization.

Actual backend-specific behavior (e.g., OpenRosa/KoboCAT) is implemented in the backend class (see `kpi/deployment_backends/openrosa_backend.py`, notably `redeploy`).

## Database architecture (from settings + migrations + deployment context)

KPI runs multiple datastores. The authoritative configuration is in `kobo/settings/base.py`, and the deployment context provided shows the containers running in the environment:

* **PostgreSQL (shared container)** — `kobobe-postgres-1` (PostGIS 14) hosts both the KPI and KoboCAT schemas, split by database alias in Django.
* **MongoDB** — `kobobe-mongo-1` holds submission documents.
* **Redis** — `kobobe-redis_main-1` and `kobobe-redis_cache-1` handle caches and sessions.
* **KPI app / workers** — `kobofe-kpi-1`, `kobofe-worker*`, and `kobofe-beat-1` run the API, background jobs, and scheduled tasks.
* **Nginx** — `kobofe-nginx-1` and `nginx-certbot-nginx_ssl_proxy-1` front the services and terminate TLS.
* **Enketo** — `kobofe-enketo_express-1` provides Enketo form rendering.

## Key tables (non-exhaustive, by flow)

The migrations declare many tables; the list below focuses on the tables most relevant to asset listing, deployment, sharing, and deletion.

**KPI (default Postgres)**

* **`kpi_asset`** — Assets/projects (`kpi/models/asset.py`).
* **`kpi_assetversion`** — Asset versions (`kpi/models/asset_version.py`).
* **`kpi_assetfile`** — Asset files/media (`kpi/models/asset_file.py`).
* **`kpi_assetexportssettings`** — Export settings (`kpi/models/asset_export_settings.py`).
* **`kpi_assetsnapshot`** — Snapshot metadata (`kpi/models/asset_snapshot.py`).
* **`organizations_organization`** — Organizations (`kobo/apps/organizations/models.py`).
* **`organizations_organizationuser`** — Organization membership join table (`kobo/apps/organizations/migrations/0001_initial.py`).
* **`auth_user`** (and related profile tables) — User accounts (`kobo/apps/kobo_auth/models.py`).

**KoboCAT/OpenRosa (kobocat Postgres alias)**

* **`logger_xform`** — Form definitions in the OpenRosa app (`kobo/apps/openrosa/apps/logger/models/xform.py`).
* **`logger_instance`** — Submission instance metadata (`kobo/apps/openrosa/apps/logger/models/instance.py`).

**MongoDB**

* **Submission documents** — Actual submission payloads (Mongo collections accessed via `MONGO_DB` in `kobo/settings/base.py`).

> Note: This list is intentionally scoped to the assets/deployments flow. For a complete table inventory, inspect the migrations under each Django app.

## Updated evidence from the incident report

The latest field report contradicts the initial hypothesis that the organization record is missing:

* `GET /api/v2/organizations/orggEoXcwRkY2nzHY6HzboVR/` returns **200 OK** with a complete organization payload.
* `GET /api/v2/organizations/orggEoXcwRkY2nzHY6HzboVR/assets/` returns **200 OK** with an **empty result set** (`count: 0`).
* The global list (`GET /api/v2/assets/?q=asset_type:survey`) returns **500**.
* The communityvoices account still reports errors when listing assets and when attempting to delete forms.
* Sharing a newly deployed form with communityvoices still triggers a 500 in the projects UI.

Given those observations, the failure is not caused by the organization record being missing. The failure is more likely tied to **per-asset organization membership lookups, serializer assumptions**, or permission data for assets that are included in the global list.

## Why asset listing can fail under the incident conditions (revised)

### The crash point

In the incident description, users whose data includes a broken organization reference trigger a 500 when listing assets. The most plausible crash path based on current code is:

1. The list view builds `organizations_per_asset` using `AssetViewSetListMixin.get_organizations_per_asset_ids()`.
2. If an asset owner has **no valid organization membership** (for example, a missing/invalid `OrganizationUser` join row), the prefetch used by `get_organizations_per_asset_ids()` can yield **no organization** for that owner.
3. Serializer helpers assume a valid organization object when building metadata. For example, `AssetListSerializer.get_owner_label()` calls `organization.is_owner(...)` and `organization.is_mmo` without guarding for `None`. That produces an `AttributeError`, which surfaces as a 500 for the list endpoint.

Code paths involved:

* `kpi/mixins/asset.py` — organization prefetch for assets.
* `kpi/views/v2/asset.py` — context construction for lists.
* `kpi/serializers/v2/asset.py` — `get_owner_label()` calls `organization.is_owner(...)` and `organization.is_mmo` without a `None` guard.
* `kpi/serializers/v2/asset.py` — `get_access_types()` also calls `organization.get_user_role(...)` for collection assets.

### Why the organization detail endpoint may differ

* `GET /api/v2/organizations/{uid}/` is handled by `OrganizationViewSet` and filters the queryset to organizations containing the user.
* That endpoint can return **200 OK** even when asset-listing still fails, because the list view uses **per-asset organization lookups** that are independent of whether the requesting user can fetch their own organization record.

Code: `kobo/apps/organizations/views.py` (`OrganizationViewSet.get_queryset`).

### Likely data issue that triggers the crash

The failure described in the incident (500 on `/api/v2/assets/` with a valid organization record) aligns with a **corrupted organization membership link** for **one or more asset owners**. If an asset owner is missing a valid `OrganizationUser` join row, the prefetch used by asset listing fails to populate `organizations_per_asset`, leaving `organization` as `None` in the serializer.

Once that `None` reaches `get_owner_label()` (or `get_access_types()` for collection assets), the serializer raises an `AttributeError`, leading to the 500 error observed in production logs.

## Remediation guidance (aligned with the incident)

### Data repair

* Identify users whose organization membership points at a missing organization ID. Remove or repair the invalid membership row so the user has either:
  * a valid organization membership, or
  * no membership (allowing `User.organization` to create a default org on demand).

Relevant model and relation:

* `Organization` / `OrganizationUser` relationship in `kobo/apps/organizations/models.py`.

### Defensive code change (optional hardening)

To guard against future corrupt data, consider adding a `None` check in `AssetListSerializer.get_access_types()` before calling `organization.get_user_role(...)`. That would make asset listing resilient even when the org reference is missing.

Code to adjust:

* `kpi/serializers/v2/asset.py` (`get_access_types`).

## Delete flow (forms/projects)

Deletion in KPI is implemented via the bulk actions serializer and is invoked from the asset viewset:

1. **API entry points**
   * `DELETE /api/v2/assets/{uid}/` uses `AssetViewSet.perform_destroy_override` which forwards to `_bulk_asset_actions(...)`.
   * `POST /api/v2/assets/bulk/` can delete multiple assets with an `action` payload.
   * Code: `kpi/views/v2/asset.py` (`perform_destroy_override`, `bulk`, `_bulk_asset_actions`).

2. **Bulk action routing**
   * `AssetBulkActionsSerializer` validates permissions and action type, then routes deletes to the project trash subsystem.
   * Code: `kpi/serializers/v2/asset.py` (`AssetBulkActionsSerializer`).

3. **Soft delete + background tasks**
   * Deletion requests route through `ProjectTrash.toggle_statuses(...)` and the trash task pipeline. These steps enforce retention and prevent concurrent deletes.
   * Code: `kpi/serializers/v2/asset.py` (`_create_tasks`, `_delete_tasks`).

If deletion is failing for `communityvoices`, it is likely failing in the same serializer path as listing or in permissions checks inside the bulk action validator.

## How to sync KoboCAT and KPI

KPI provides a management command and a user endpoint that synchronize OpenRosa/KoboCAT XForms into KPI assets:

1. **Management command**
   * `./manage.py sync_kobocat_xforms`
   * This command fetches XForms from the KoboCAT API, converts them to KPI asset content, and updates deployment metadata.
   * Code: `kpi/management/commands/sync_kobocat_xforms.py`.

2. **API endpoint (user migration)**
   * `GET /api/v2/users/{username}/migrate/` triggers a Celery task to sync the user’s forms, including form media.
   * Code: `kpi/views/v2/user.py` (`migrate` action) and `kpi/tasks.py` (`sync_kobocat_xforms` task).

These tools are the supported path to reconcile KoboCAT records with KPI assets in a dual-database deployment.

## Data cleanup queries (SQL examples)

The incident points to **inconsistent organization membership data** for one or more users. The SQL below helps identify and repair broken membership rows. Run these against the KPI (default) Postgres database.

> ⚠️ Always back up the database or test in staging before running writes.

### 1) Find organization memberships pointing to missing organizations

```sql
SELECT ou.id AS org_user_id,
       ou.user_id,
       ou.organization_id
FROM organizations_organizationuser ou
LEFT JOIN organizations_organization o
  ON o.id = ou.organization_id
WHERE o.id IS NULL;
```

### 2) Find users without any organization membership

```sql
SELECT u.id AS user_id,
       u.username
FROM auth_user u
LEFT JOIN organizations_organizationuser ou
  ON ou.user_id = u.id
WHERE ou.id IS NULL;
```

### 3) Remove broken organization membership rows

```sql
DELETE FROM organizations_organizationuser
WHERE organization_id NOT IN (
  SELECT id FROM organizations_organization
);
```

### 4) Verify organization ownership row consistency

```sql
SELECT oo.id AS owner_id,
       oo.organization_id,
       ou.user_id AS owner_user_id
FROM organizations_organizationowner oo
JOIN organizations_organizationuser ou
  ON ou.id = oo.organization_user_id
LEFT JOIN organizations_organization o
  ON o.id = oo.organization_id
WHERE o.id IS NULL;
```

### 5) Identify assets owned by users without org memberships

```sql
SELECT a.id AS asset_id,
       a.uid AS asset_uid,
       a.owner_id,
       u.username
FROM kpi_asset a
JOIN auth_user u
  ON u.id = a.owner_id
LEFT JOIN organizations_organizationuser ou
  ON ou.user_id = a.owner_id
WHERE ou.id IS NULL;
```

---

If you want this document expanded with more front-end request flow details or additional SQL queries for cleanup, call that out and I can add those details.

