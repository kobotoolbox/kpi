## List project history logs

Lists all project history logs for a single project.

<sup>*</sup> _Required permissions: `manage_asset` (Manage project)_

Results from this endpoint can be filtered by a Boolean query specified in the q parameter.

### Filterable fields for all project history logs:

  date_created

  user_uid

  user__*
  - user__username
  - user__email
  - user__is_superuser

  metadata__*

  - metadata__source
  - metadata__ip_address
  - metadata__asset_uid
  - metadata__log_subtype
    - available subtypes: "project", "permission"

### action

available actions:
  - add-media
  - add-submission
  - allow-anonymous-submissions
  - archive
  - clone-permissions
  - connect-project
  - delete-media
  - delete-service
  - delete-submission
  - deploy
  - disable-sharing
  - disallow-anonymous-submissions
  - disconnect-project
  - enable-sharing
  - export
  - modify-imported-fields
  - modify-qa-data
  - modify-service
  - modify-sharing
  - modify-submission
  - modify-user-permissions
  - redeploy
   - register-service
  - replace-form
  - share-data-publicly
  - share-form-publicly
  - transfer
  - unarchive
  - unshare-data-publicly
  - unshare-form-publicly
  - update-content
  - update-name
  - update-settings
  - update-qa

### Filterable fields by action:

  add-media
  - metadata__asset-file__uid
  - metadata__asset-file__filename

  add-submission
  - metadata__submission__submitted_by
  - metadata__submission__root_uuid

  archive
  - metadata__latest_version_uid

  clone-permissions
  - metadata__cloned_from

  connect-project
  - metadata__paired-data__source_uid
  - metadata__paired-data__source_name

  delete-media
  - metadata__asset-file__uid
  - metadata__asset-file__filename

  delete-service
  - metadata__hook__uid
  - metadata__hook__endpoint
  - metadata__hook__active

  delete-submission
  - metadata__submission__submitted_by
  - metadata__submission__root_uuid

  deploy
  - metadata__latest_version_uid
  - metadata__latest_deployed_version_uid

  disconnect-project
  - metadata__paired-data__source_uid
  - metadata__paired-data__source_name

  modify-imported-fields
  - metadata__paired-data__source_uid
  - metadata__paired-data__source_name

  modify-qa-data
  - metadata__submission__submitted_by
  - metadata__submission__root_uuid

  modify-service
  - metadata__hook__uid
  - metadata__hook__endpoint
  - metadata__hook__active

  modify-submission
  - metadata__submission__submitted_by
  - metadata__submission__root_uuid
  - metadata__submission__status (only present if changed)

  modify-user-permissions
  - metadata__permissions__username

  redeploy
  - metadata__latest_version_uid
  - metadata__latest_deployed_version_uid

  register-service
  - metadata__hook__uid
  - metadata__hook__endpoint
  - metadata__hook__active

  transfer
  - metadata__username

  unarchive
  - metadata__latest_version_uid

  update-name
  - metadata__name__old
  - metadata__name__new

  update-settings
  - metadata__settings__description__old
  - metadata__settings__description__new

This endpoint can be paginated with 'offset' and 'limit' parameters.

