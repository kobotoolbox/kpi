# Endpoint deprecations

## As of release 2.026.43

The endpoint below is deprecated and will be removed in a future release.

URL Pattern | View Class or Function | View Name | Replacement
-- | -- | -- | --
`/api/v2/users/<username>/migrate/` | `kpi.views.v2.user.UserViewSet` | `user-kpi-migrate` | None<sup>*</sup>

<sup>*</sup> _Projects can only be deployed through KPI, so there are no KoboCAT forms left to sync._

## `v1` API

All previously deprecated `v1` endpoints (KoboCAT and KPI) were permanently
removed as of release 2.026.22. See [REMOVALS.md](REMOVALS.md) for the
complete list.
