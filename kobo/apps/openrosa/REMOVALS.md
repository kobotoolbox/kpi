# OpenRosa endpoint removals

## Obsolete Data Access and Management

The following data access and management API endpoints have been deprecated in favor of using the OpenRosa classes withing python code in Kpi.

URL Pattern | View Class or Function | Description
-- | -- | --
*`DELETE`* `/api/v1/data/<instance id>/<submission id>` | `kobo.apps.openrosa.apps.api.viewsets.data_viewset.DataViewSet.destroy` | Delete submissions
*`PATCH`, `GET`* `/api/v1/data/<instance id>/<submission id>/validation_status` | `kobo.apps.openrosa.apps.api.viewsets.data_viewset.DataViewSet.validation_status` | Modify validation status of specific instance.
*`GET`* `/api/v1/data/<instance id>/bulk_validation_status` |  `kobo.apps.openrosa.apps.api.viewsets.data_viewset.DataViewSet.bulk_validation_status` | Bulk delete submissions
*`GET`* `/api/v1/data/<instance id>/bulk_delete` | `kobo.apps.openrosa.apps.api.viewsets.data_viewset.DataViewSet.bulk_delete` | Bulk set multiple instance validation status
*`GET`* `/api/v1/data/<instance id>/<submission_id>/enketo` | `kobo.apps.openrosa.apps.api.viewsets.data_viewset.DataViewSet.enketo` | Proxy for enketo_edit
*`GET`* `/api/v1/data/<instance id>/<submission_id>/enketo_edit` | `kobo.apps.openrosa.apps.api.viewsets.data_viewset.DataViewSet.enketo_edit` | Handle enketo edit request
*`GET`* `/api/v1/data/<instance id>/<submission_id>/enketo_view` | `kobo.apps.openrosa.apps.api.viewsets.data_viewset.DataViewSet.enketo_view` | Handle enketo view request
