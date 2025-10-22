# InsightZen Telephone Interviewer Specification

This guide documents the backend and frontend architecture for the InsightZen **Telephone Interviewer** panel. It builds on the quota management specification so that interviewers receive numbers only when quota cells have remaining capacity.

## 0. Goal and Scope

* Assign sample phone numbers to interviewers according to active quota schemes.
* Track the lifecycle of each telephone interview, including start/end timestamps and outcome codes.
* Provide real-time dashboards for supervisors and allow interviewers to update statuses directly.
* Guarantee that sample reservations expire automatically to prevent deadlocks.

## 1. Data Model (Django / PostgreSQL 17)

All entities are defined in `kobo/apps/insightzen_core/models.py` and interact with quota models described in `quota_management.md`.

### 1.1 DialerAssignment

```python
class DialerAssignment(models.Model):
    project = models.ForeignKey(InsightProject, on_delete=models.CASCADE, related_name='assignments')
    scheme = models.ForeignKey(QuotaScheme, on_delete=models.PROTECT, related_name='+')
    cell = models.ForeignKey(QuotaCell, on_delete=models.PROTECT, related_name='+')
    interviewer = models.ForeignKey(User, on_delete=models.PROTECT, related_name='+')
    sample = models.ForeignKey(SampleContact, on_delete=models.PROTECT, related_name='+')
    status = models.CharField(
        max_length=16,
        choices=[
            ('reserved', 'Reserved'),
            ('completed', 'Completed'),
            ('failed', 'Failed'),
            ('expired', 'Expired'),
            ('cancelled', 'Cancelled'),
        ],
        default='reserved',
    )
    reserved_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    completed_at = models.DateTimeField(null=True, blank=True)
    outcome_code = models.CharField(max_length=8, null=True, blank=True)
    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['project', 'status']),
            models.Index(fields=['cell', 'status']),
            models.Index(fields=['sample', 'status']),
        ]
```

* Captures the binding between an interviewer, the selected sample contact, and the quota cell.
* TTL enforcement relies on `expires_at`. A periodic job moves stale reservations to `expired`.
* `meta` holds auxiliary information (dialer channel, retries, notes).

### 1.2 Interview

```python
class Interview(models.Model):
    assignment = models.OneToOneField(DialerAssignment, on_delete=models.CASCADE, related_name='interview')
    start_form = models.DateTimeField(null=True, blank=True)
    end_form = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=16,
        choices=[
            ('not_started', 'Not Started'),
            ('in_progress', 'In Progress'),
            ('completed', 'Completed'),
        ],
        default='not_started',
    )
    outcome_code = models.CharField(max_length=8, null=True, blank=True)
    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [models.Index(fields=['assignment', 'status'])]
```

* Mirrors dialer status transitions and stores timestamps for auditing.
* `outcome_code` echoes the assignment outcome but allows additional context when required by downstream reporting.

## 2. API (Django REST Framework)

Endpoints are mounted under `/api/insightzen/` and reuse the `InsightZenAccessMixin` plus fine-grained permissions.

### 2.1 Assignments

* `GET /assignments?project=:id` — list assignments for a project; supports filters (`status`, `interviewer`, `phone`, `scheme`).
* `POST /assignments` — create a manual assignment (supervisors only).
* `PATCH /assignments/{id}` — update metadata or reassign to a different interviewer.
* `POST /assignments/{id}/expire` — force-expire an assignment that exceeded TTL.
* `POST /assignments/{id}/complete` — mark as completed with an optional `outcome_code` payload.
* `POST /assignments/{id}/failed` — set status to failed, logging the associated outcome.

All mutations update quota counters transactionally (`F()` expressions on `QuotaCell`).

### 2.2 Interviews

* `GET /interviews/{assignment_id}` — retrieve interview details for a specific assignment.
* `POST /interviews/start` — body `{ "assignment": id }`; sets `start_form`, marks status `in_progress`.
* `POST /interviews/complete` — body `{ "assignment": id, "outcome_code": "COMP", "meta": {...} }`; sets `end_form`, marks status `completed`, and cascades to the linked assignment.

### 2.3 Dialer Automation

* `POST /dialer/next` — body `{ "project": id, "interviewer": id, "scheme": optional }`; returns `{ assignment_id, sample, cell, scheme, expires_at }`.
* `POST /dialer/cancel` — body `{ "assignment": id }`; reverts `in_progress` counters and releases the sample.
* `POST /dialer/heartbeat` — optional endpoint to extend `expires_at` when the interviewer remains active.

All dialer endpoints are idempotent and use optimistic retries; duplicate submissions simply return the current assignment state without double counting.

## 3. Dialer Logic

1. Reject new assignments when the interviewer already holds an active reservation.
2. Select the active `QuotaScheme` (see quota spec §3).
3. Rank eligible cells based on overflow policy.
4. Within a transaction:
   * Lock candidate samples (`select_for_update(skip_locked=True)`).
   * Create `DialerAssignment` and set `expires_at = now() + TTL` (15 minutes by default).
   * Increment `QuotaCell.in_progress`.
5. Return assignment payload. If no eligible sample exists, respond with `no_available_assignments`.
6. On completion, decrement `in_progress`, increment `achieved`, and stamp timestamps on the `Interview` record.
7. On failure/cancel/expire, decrement `in_progress` and reopen the sample (`SampleContact.is_active=True`).

## 4. UI/UX

Telephone Interviewer UI assets live under `jsapp/src/insightzen/telephone-interviewer/` (to be created). The router adds `/insightzen/telephone-interviewer` routes that respect the InsightZen dark theme.

### 4.1 Assignment List (`AssignmentList.jsx`)

* Displays a paginated table of assignments with columns: Phone, Interviewer, Status, Reserved At, Expires At, Completed At, Outcome, Actions.
* Filters for status, interviewer, project, and free-text search (phone/name) with 400 ms debounce.
* Sticky action column offering **Start**, **Complete**, **Fail**, and **Cancel** buttons depending on status and role.
* Empty state encourages supervisors to trigger the dialer when no assignments exist.

### 4.2 Assignment Details (`AssignmentDetails.jsx`)

* Shows selector metadata (gender, age band, province, etc.), outcome history, and audit log entries.
* Surface countdown timer for TTL expiry and highlight overdue reservations in red.
* Provide a secondary panel with linked interview statistics (duration, agent notes).

### 4.3 Shared Components

* `DialerTable.jsx` — reusable table scaffold with horizontal scrolling constrained to the table container; header and action column remain sticky.
* `AssignmentFilter.jsx` — collapsible accordion filter panel with animated open/close (180 ms) consistent with InsightZen navigation.
* `InterviewStatus.jsx` — badge component reflecting interview state with accessible colour contrast.

### 4.4 Access Control

* `agent`/`supervisor` roles view only assignments tied to projects where they hold active memberships.
* Supervisors can reassign, expire, or manually create assignments; agents can only start, complete, or cancel their own assignments.
* Personal accounts never surface the Telephone Interviewer module because InsightZen is restricted to organisational subscriptions.

## 5. Edge Cases & Testing

* TTL expiration runs server-side jobs to prevent stuck reservations even if clients disconnect.
* Failed or cancelled assignments reactivate the sample and log the event for auditing.
* Concurrency tests ensure two interviewers cannot obtain the same sample; database locks plus unique constraints on active reservations enforce this.
* UI integration tests cover filter behaviour, assignment status transitions, keyboard accessibility, and localisation toggles (fa/en, RTL support).

## 6. Integration with Quota Management

* Assignment creation requires a published scheme; otherwise the dialer rejects the request.
* `QuotaCell` counters drive progress charts in both Quota Management and Telephone Interviewer dashboards.
* The Telephone Interviewer list surfaces quota progress indicators (remaining vs. target) using the shared API endpoints from `quotas.ts`.

## 7. Deployment & Monitoring

* Emit structured logs on every assignment status transition (`reserved`, `completed`, `failed`, `expired`, `cancelled`).
* Capture metrics for average time-to-complete, cancellation rate, and quota saturation to feed operational dashboards.
* Feature flags allow gradual rollout of overflow policies and TTL adjustments.

