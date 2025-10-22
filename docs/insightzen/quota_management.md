# InsightZen Quota Management Specification

This document captures the architecture and product decisions for the InsightZen **Quota Management** panel that were agreed with the product team. It complements the existing implementation that lives under `kobo/apps/insightzen_core` and `jsapp/src/insightzen/quotas`.

## 0. Goal and Scope

* Manage multi-dimensional quota targets for each InsightZen project and keep telephone interviewing operations aligned with quota progress.
* Provide a live view of progress (target vs. achieved vs. in-progress vs. remaining) and enable controlled editing/versioning of quota definitions.
* Integrate tightly with the Telephone Interviewer workflow so that only eligible quota cells receive new sample assignments.
* Support Excel import/export, sandbox previews prior to publication, and a detailed audit trail of changes.

## 1. Data Model (Django / PostgreSQL 17)

All database artefacts live in the `insightzen_core` Django app. PostgreSQL 17 is required so that we can rely on native `jsonb` operators and `text[]` index support.

### 1.1 InsightProject

Projects are already implemented through the `InsightProject` model. All new quota entities reference projects through foreign keys and inherit the RBAC rules defined for InsightZen memberships.

### 1.2 QuotaScheme

```python
class QuotaScheme(models.Model):
    project = models.ForeignKey(InsightProject, on_delete=models.CASCADE, related_name='quota_schemes')
    name = models.CharField(max_length=128)
    version = models.PositiveIntegerField(default=1)
    status = models.CharField(
        max_length=16,
        choices=[('draft', 'Draft'), ('published', 'Published'), ('archived', 'Archived')],
        default='draft',
    )
    dimensions = models.JSONField(default=list)
    overflow_policy = models.CharField(
        max_length=16,
        choices=[('strict', 'Strict'), ('soft', 'Soft'), ('weighted', 'Weighted')],
        default='strict',
    )
    priority = models.IntegerField(default=0)
    is_default = models.BooleanField(default=False)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('project', 'name', 'version')
```

* `dimensions` stores the dimension schema as JSON (see §1.3).
* `overflow_policy` governs how the dialer resolves conflicts when multiple cells are eligible.
* `priority` is used when several published schemes exist; higher priority wins, falling back to `published_at` recency.
* Setting `is_default=True` marks the scheme to be used for dialer requests that do not specify a scheme.

### 1.3 Dimensions

Each entry in `QuotaScheme.dimensions` describes a categorical dimension and the set of accepted values. Example:

```json
[
  {
    "key": "gender",
    "label": "Gender",
    "type": "categorical",
    "values": [
      {"value": "male", "label": "Male"},
      {"value": "female", "label": "Female"}
    ],
    "required": true
  },
  {
    "key": "age_band",
    "label": "Age Band",
    "type": "categorical",
    "values": [
      {"value": "18-24"},
      {"value": "25-34"},
      {"value": "35-44"},
      {"value": "45+"}
    ],
    "required": true
  },
  {
    "key": "province_code",
    "label": "Province",
    "type": "categorical",
    "values": [
      {"value": "01"},
      {"value": "02"}
    ],
    "required": false
  }
]
```

### 1.4 QuotaCell

```python
class QuotaCell(models.Model):
    scheme = models.ForeignKey(QuotaScheme, on_delete=models.CASCADE, related_name='cells')
    selector = models.JSONField()
    label = models.CharField(max_length=256, blank=True)
    target = models.PositiveIntegerField()
    soft_cap = models.PositiveIntegerField(null=True, blank=True)
    weight = models.FloatField(default=1.0)
    achieved = models.PositiveIntegerField(default=0)
    in_progress = models.PositiveIntegerField(default=0)
    reserved = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=['scheme'])]
```

* `selector` holds the dimension combination (e.g. `{ "gender": "female", "age_band": "25-34" }`).
* Counters are denormalised for performance. They are updated transactionally by the dialer and periodically reconciled by background jobs.

### 1.5 Sample Contacts and Dialer Assignments

Sample contacts represent the telephone dialling pool and are stored as `SampleContact` rows, using strongly indexed columns (project, active flag, and dimension keys). `DialerAssignment` captures reservations. See the Telephone Interviewer specification for additional detail (§5).

### 1.6 Interview Capture

Interviews reuse the existing `core_interview` schema, enriching it with `start_form` and `end_form` timestamps. Counter updates are triggered only on successful completion events.

## 2. API (Django REST Framework)

The REST surface is mounted under `/api/insightzen/quotas/` and is protected by the InsightZen RBAC mixins.

### 2.1 Schemes

* `GET /schemes?project=:id` — paginated list of schemes for a project.
* `POST /schemes` — create a draft scheme.
* `PATCH /schemes/{id}` — update mutable fields while in `draft`.
* `POST /schemes/{id}/publish` — lock dimensions, materialise cells, set `published_at`.
* `POST /schemes/{id}/archive` — archive a scheme; published data remains read-only.

### 2.2 Cells

* `GET /schemes/{id}/cells` — list cells with filters such as `complete` and `q`.
* `PATCH /cells/{id}` — adjust numeric fields (`target`, `soft_cap`, `weight`, `label`).
* `POST /schemes/{id}/cells/bulk_upsert` — upload Excel/CSV content into the scheme.
* `GET /schemes/{id}/stats` — aggregated statistics grouped by dimension selections.

### 2.3 Dialer Integration

* `POST /dialer/next` — return the next available assignment for a project or scheme.
* `POST /dialer/complete` — mark an assignment as completed and increment counters.
* `POST /dialer/cancel` — cancel reservations so the sample is eligible again.
* `POST /dialer/heartbeat` — optional keep-alive to extend `expires_at`.

All endpoints are idempotent; retries do not double count quota progress.

## 3. Assignment Algorithm

1. Determine the active scheme (`is_default=True`, highest `priority`, latest `published_at`).
2. Rank eligible cells:
   * **Strict**: `achieved < target`.
   * **Soft**: `achieved < soft_cap` when present, otherwise follow strict rules.
   * **Weighted**: `remaining_weight = weight * max(target - (achieved + in_progress), 0)`.
3. Inside a transaction, pick a matching sample (`select_for_update(skip_locked=True)`).
4. Create a `DialerAssignment`, increment `in_progress`, and return payload.
5. If no cells have remaining capacity, return a sentinel (`no_eligible_cell_or_sample`).

## 4. UI/UX

Routes are served under `/insightzen/quotas` in the standalone InsightZen React router (`jsapp/src/insightzen/InsightZenApp.tsx`). The React layout follows the KPI design system with a dedicated dark theme.

### 4.1 Schemes List (`SchemesListPage.tsx`)

* Filter by project (restricted to the viewer's memberships).
* Provide quick actions: **New Scheme**, **Export**, **Import**, **Publish**, **Archive**.
* Highlight the default scheme and show status badges for draft/published/archived.

### 4.2 Scheme Editor (`SchemeEditorPage.tsx`)

Multi-tab experience:

1. **Design** — `DimensionsBuilder`, `CellsPivotGrid`, and `BulkEditPanel` for inline editing, fill/distribute helpers, and validation warnings.
2. **Progress** — `SchemeKPI` summary cards and `QuotaCharts` (bar and donut charts).
3. **Import/Export & Audit** — Excel templates, change log review, and warnings.

Tables expose horizontal scrolling only on the table container, with sticky headers and action columns. All interactive elements support both LTR and RTL and meet accessibility requirements for keyboard focus and contrast.

### 4.3 Wizard

Creating a scheme launches a wizard that walks through dimension selection, value definition (manual or CSV import), matrix generation, preview, and final confirmation. Validation ensures selectors are unique and optional warnings call out sample capacity mismatches.

## 5. Validation & Business Rules

* Counters cannot exceed the configured limits: `target` for strict mode, `soft_cap` when present in soft mode.
* Selector uniqueness is enforced per scheme.
* Published schemes lock dimensions; editing numeric fields can either happen inline or by cloning into a new version (`version + 1`).
* Warnings are issued when total targets exceed sample pool capacity.
* Changes are audited with timestamps, the responsible user, and before/after payloads.

## 6. Performance

* Add BTREE indexes on frequently filtered fields (`project`, `status`) and GIN indexes on JSON selectors or `text[]` lists when appropriate.
* Denormalised counters are reconciled by scheduled jobs (5–10 minute cadence) using SUM aggregation over interview logs.
* Dialer queries rely on `select_for_update(skip_locked=True)` to avoid race conditions.

## 7. Security & Access Control

* Only users with `collection.quota=true` permissions see the Quota Management panel.
* Only project `admin` or `manager` roles may create, publish, or archive schemes.
* Dialer APIs are restricted to operational roles (`agent`, `supervisor`) and enforce project membership checks.

## 8. Monitoring & Observability

* Log scheme lifecycle events, dialer assignment transitions, and import/export outcomes.
* Provide health diagnostics (expired reservations, cells at capacity, invalid defaults).
* Instrument dialer latency and sample selection retries for future tuning.

## 9. Edge Cases & Testing

* Expired assignments automatically decrement `in_progress` and reopen the sample.
* Dimension changes after publication require a new version and optional migration tooling.
* Comprehensive test coverage spans models (selectors, counters), APIs (overflow policies, concurrency), UI interactions (filters, pivot editing), and dialer integration (start/end timestamps).

## 10. Excel Templates

* **Export** produces three sheets: `scheme_meta`, `dimensions`, and `cells` with progress counters.
* **Import** consumes the `cells` sheet to update numeric fields; selectors are inferred from column headers.

## 11. Migration & Compatibility

* Migrations create the new tables and relations.
* Background jobs backfill historical interview data into counters.
* Legacy quota definitions (if any) are migrated into the new schema using a dedicated management command.

