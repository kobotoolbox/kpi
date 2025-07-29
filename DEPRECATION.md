# Endpoint deprecation as of release 2.025.30

⚠️ The deprecated endpoints listed below will be permanently removed with the first release of 2026, scheduled for the week of **January 19, 2026**.

We strongly encourage all developers and users with integrations to update their systems as soon as possible to avoid disruption.
A new support article will be available soon to guide users through the migration from KoboCAT `v1` to KPI `v2`.

## KoboCAT endpoints

### Data

URL Pattern | View Class or Function                                           | View Name | Equivalent KPI `v2` Endpoint
-- |------------------------------------------------------------------| -- | --
`/api/v1/data` | `kobo.apps.openrosa.apps.api.viewsets.data_viewset.DataViewSet` | `data-list` | `/api/v2/assets/`
`/api/v1/data/<pk>` | `kobo.apps.openrosa.apps.api.viewsets.data_viewset.DataViewSet` | `data-list` | `/api/v2/assets/<parent_lookup_asset>/data/`
`/api/v1/data/<pk>/<dataid>` | `kobo.apps.openrosa.apps.api.viewsets.data_viewset.DataViewSet` | `data-detail` | `/api/v2/assets/<parent_lookup_asset>/data/<pk>/`
`/api/v1/data/<pk>/<dataid>/labels` | `kobo.apps.openrosa.apps.api.viewsets.data_viewset.DataViewSet` | `data-labels` | None<sup>*</sup>
`/api/v1/data/<pk>/<dataid>/labels/<label>` | `kobo.apps.openrosa.apps.api.viewsets.data_viewset.DataViewSet` | `data-labels-extra` | None<sup>*</sup>

<sup>*</sup> _These endpoints will be permanently removed and have not been carried over to the `v2` API due to very low or no usage._

### Forms

URL Pattern | View Class or Function                                           | View Name | Equivalent KPI `v2` Endpoint
-- |------------------------------------------------------------------| -- | --
`/api/v1/forms` | 	kobo.apps.openrosa.apps.api.viewsets.xform_viewset.XFormViewSet | xform-list | `/api/v2/assets/`
`/api/v1/forms/<pk>` | kobo.apps.openrosa.apps.api.viewsets.xform_viewset.XFormViewSet  | form-detail | `/api/v2/assets/<uid>/`
`/api/v1/forms/<pk>/form.xml` | kobo.apps.openrosa.apps.api.viewsets.xform_viewset.XFormViewSet  | xform-form | `/api/v2/assets/<uid>.xml`
`/api/v1/forms/<pk>/labels` | kobo.apps.openrosa.apps.api.viewsets.xform_viewset.XFormViewSet  | xform-labels | `/api/v2/assets/<uid>/`


### Metadata

URL Pattern | View Class or Function                                           | View Name | Equivalent KPI `v2` Endpoint
-- |------------------------------------------------------------------| -- | --
`/api/v1/metadata` | `kobo.apps.openrosa.apps.api.viewsets.metadata_viewset.MetaDataViewSet` | `metadata-list` | `/api/v2/assets/<parent_lookup_asset>/files/`
`/api/v1/metadata/<pk>` | `kobo.apps.openrosa.apps.api.viewsets.metadata_viewset.MetaDataViewSet` | `metadata-detail` | `/api/v2/assets/<parent_lookup_asset>/files/<uid>/`


### Notes

URL Pattern | View Class or Function                                           | View Name | Equivalent KPI `v2` Endpoint
-- |------------------------------------------------------------------| -- | --
`/api/v1/notes` | `kobo.apps.openrosa.apps.api.viewsets.note_viewset.NoteViewSet` | `notes-list` | None<sup>*</sup>
`/api/v1/notes/<pk>` | `kobo.apps.openrosa.apps.api.viewsets.note_viewset.NoteViewSet` | `notes-detail` | None<sup>*</sup>

<sup>*</sup> _These endpoints will be permanently removed and have not been carried over to the `v2` API due to very low or no usage._

### Submissions
URL Pattern | View Class or Function                                           | View Name | Equivalent KPI `v2` Endpoint
-- |------------------------------------------------------------------| -- | --
`/api/v1/submissions` | `kobo.apps.openrosa.apps.api.viewsets.xform_submission_api.XFormSubmissionApi` | `submissions-list` | None<sup>*</sup>

<sup>*</sup> _Use OpenRosa API to submit data at https://kobocat.domain.tld/submission_

### User

URL Pattern | View Class or Function                                           | View Name | KPI `v2` endpoint
-- |------------------------------------------------------------------| -- | --
`/api/v1/user` | `kobo.apps.openrosa.apps.api.viewsets.connect_viewset.ConnectViewSet` | `userprofile-list` | `/me/`
`/api/v1/users/<username>` | `kobo.apps.openrosa.apps.api.viewsets.user.UserViewSet` | `user-detail` | `/api/v2/users/<username>/`


## KPI endpoints

URL Pattern | View Class or Function                                              | View Name | KPI `v2` endpoint
-- |---------------------------------------------------------------------| -- |----------------------------------------------------------------------
`/asset_snapshots/` | `kpi.views.v1.asset_snapshot.AssetSnapshotViewSet`                  | `assetsnapshot-list` | `/api/v2/asset_snapshots/`
`/asset_snapshots/<uid>/` | `kpi.views.v1.asset_snapshot.AssetSnapshotViewSet`                  | `assetsnapshot-detail` | `/api/v2/asset_snapshots/<uid>/`
`/asset_snapshots/<uid>/xml_with_disclaimer/` | `kpi.views.v1.asset_snapshot.AssetSnapshotViewSet`                  | `assetsnapshot-xml-with-disclaimer` | `/api/v2/asset_snapshots/<uid>/xml_with_disclaimer/`
`/asset_subscriptions/` | `kpi.views.v1.user_asset_subscription.UserAssetSubscriptionViewSet` | `userassetsubscription-list` | `/api/v2/asset_subscriptions/`
`/asset_subscriptions/<uid>/` | `kpi.views.v1.user_asset_subscription.UserAssetSubscriptionViewSet` | `userassetsubscription-detail` | `/api/v2/asset_subscriptions/<uid>/`
`/assets/` | `kpi.views.v1.asset.AssetViewSet`                                   | `asset-list` | `/api/v2/assets/`
`/assets/<parent_lookup_asset>/files/` | `kpi.views.v1.asset_file.AssetFileViewSet`                          | `asset-file-list` | `/api/v2/assets/<parent_lookup_asset>/files/`
`/assets/<parent_lookup_asset>/files/<uid>/` | `kpi.views.v1.asset_file.AssetFileViewSet`                          | `asset-file-detail` | `/api/v2/assets/<parent_lookup_asset>/files/<uid>/`
`/assets/<parent_lookup_asset>/files/<uid>/content/` | `kpi.views.v1.asset_file.AssetFileViewSet`                          | `asset-file-content` | `/api/v2/assets/<parent_lookup_asset>/files/<uid>/content/`
`/assets/<parent_lookup_asset>/submissions/` | `kpi.views.v1.submission.SubmissionViewSet`                         | `submission-list` | `/api/v2/assets/<parent_lookup_asset>/data/`
`/assets/<parent_lookup_asset>/submissions/<pk>/` | `kpi.views.v1.submission.SubmissionViewSet`                         | `submission-detail` | `/api/v2/assets/<parent_lookup_asset>/data/<pk>/`
`/assets/<parent_lookup_asset>/submissions/<pk>/edit/` | `kpi.views.v1.submission.SubmissionViewSet`                          | `submission-enketo-edit` | `/api/v2/assets/<parent_lookup_asset>/data/<pk>/enketo/edit/`
`/assets/<parent_lookup_asset>/submissions/<pk>/duplicate/` | `kpi.views.v1.submission.SubmissionViewSet`                         | `submission-duplicate` | `/api/v2/assets/<parent_lookup_asset>/data/<pk>/duplicate/`
`/assets/<parent_lookup_asset>/submissions/<pk>/enketo/<var>view/` | `kpi.views.v1.submission.SubmissionViewSet`                         | `submission-enketo-view` | `/api/v2/assets/<parent_lookup_asset>/data/<pk>/enketo/<var>view/`
`/assets/<parent_lookup_asset>/submissions/<pk>/validation_status/` | `kpi.views.v1.submission.SubmissionViewSet`                         | `submission-validation-status` | `/api/v2/assets/<parent_lookup_asset>/data/<pk>/validation_status/`
`/assets/<parent_lookup_asset>/submissions/bulk/` | `kpi.views.v1.submission.SubmissionViewSet`                         | `submission-bulk` | `/api/v2/assets/<parent_lookup_asset>/data/bulk/`
`/assets/<parent_lookup_asset>/submissions/validation_statuses/` | `kpi.views.v1.submission.SubmissionViewSet`                         | `submission-validation-statuses` | `/api/v2/assets/<parent_lookup_asset>/data/validation_statuses/`
`/assets/<parent_lookup_asset>/versions/` | `kpi.views.v1.asset_version.AssetVersionViewSet`                    | `asset-version-list` | `/api/v2/assets/<parent_lookup_asset>/versions/`
`/assets/<parent_lookup_asset>/versions/<uid>/` | `kpi.views.v1.asset_version.AssetVersionViewSet`                    | `asset-version-detail` | `/api/v2/assets/<parent_lookup_asset>/versions/<uid>/`
`/assets/<uid>/` | `kpi.views.v1.asset.AssetViewSet`                                   | `asset-detail` | `/api/v2/assets/<uid>/`
`/assets/<uid>/content/` | `kpi.views.v1.asset.AssetViewSet`                                   | `asset-content` | `/api/v2/assets/<uid>/content/`
`/assets/<uid>/deployment/` | `kpi.views.v1.asset.AssetViewSet`                                   | `asset-deployment` | `/api/v2/assets/<uid>/deployment/`
`/assets/<uid>/permissions/` | `kpi.views.v1.asset.AssetViewSet`                                   | `asset-permissions` | `/api/v2/assets/<uid>/permissions/`
`/assets/<uid>/reports/` | `kpi.views.v1.asset.AssetViewSet`                                   | `asset-reports` | `/api/v2/assets/<uid>/reports/`
`/assets/<uid>/table_view/` | `kpi.views.v1.asset.AssetViewSet`                                   | `asset-table-view` | `/api/v2/assets/<uid>/table_view/`
`/assets/<uid>/valid_content/` | `kpi.views.v1.asset.AssetViewSet`                                   | `asset-valid-content` | `/api/v2/assets/<uid>/valid_content/`
`/assets/<uid>/xform/` | `kpi.views.v1.asset.AssetViewSet`                                   | `asset-xform` | `/api/v2/assets/<uid>/xform/`
`/assets/<uid>/xls/` | `kpi.views.v1.asset.AssetViewSet`                                   | `asset-xls` | `/api/v2/assets/<uid>/xls/`
`/assets/bulk/` | `kpi.views.v1.asset.AssetViewSet`                                   | `asset-bulk` | `/api/v2/assets/bulk/`
`/assets/hash/` | `kpi.views.v1.asset.AssetViewSet`                                   | `asset-hash` | `/api/v2/assets/hash/`
`/assets/metadata/` | `kpi.views.v1.asset.AssetViewSet`                                   | `asset-metadata` | `/api/v2/assets/metadata/`
`/authorized_application/authenticate_user/` | `kpi.views.authorized_application_authenticate_user` | `authenticate_user` | `/api/v2/assets/authorized_application/authenticate_user/`
`/authorized_application/users/` | `kpi.views.v1.authorized_application_user.AuthorizedApplicationUserViewSet` | `authorized_applications-list` | `/api/v2/assets/authorized_application/authenticate_user/`
`/exports/` | `kpi.views.v1.export_task.ExportTaskViewSet`                        | `submissionexporttask-list` | `/api/v2/assets/<parent_lookup_asset>/exports/`
`/exports/<uid>/` | `kpi.views.v1.export_task.ExportTaskViewSet`                        | `submissionexporttask-detail` | `/api/v2/assets/<parent_lookup_asset>/exports/<uid>/`
`/imports/` | `kpi.views.v1.import_task.ImportTaskViewSet`                        | `importtask-list` | `/api/v2/imports/`
`/imports/<uid>/` | `kpi.views.v1.import_task.ImportTaskViewSet`                        | `importtask-detail` | `/api/v2/imports/<uid>/`
`/permissions/` | `kpi.views.v1.object_permission.ObjectPermissionViewSet`            | `objectpermission-list` | `/api/v2/assets/<parent_lookup_asset>/permission-assignments/`
`/permissions/<uid>/` | `kpi.views.v1.object_permission.ObjectPermissionViewSet`            | `objectpermission-detail` | `/api/v2/assets/<parent_lookup_asset>/permission-assignments/<uid>/`
`/tags/` | `kpi.views.v1.tag.TagViewSet`                                       | `tag-list` | `/api/v2/tags/`
`/tags/<taguid__uid>/` | `kpi.views.v1.tag.TagViewSet`                                       | `tag-detail` | `/api/v2/tags/<taguid__uid>/`
`/users/` | `kpi.views.v1.user.UserViewSet`                                     | `user-kpi-list` | `/api/v2/users/`
`/users/<username>/` | `kpi.views.v1.user.UserViewSet`                                     | `user-kpi-detail` | `/api/v2/users/<username>/`
