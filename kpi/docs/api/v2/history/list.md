## List project history logs

Lists all project history logs for a single project.

<sup>*</sup> _Required permissions: `manage_asset` (Manage project)_

    Response 200

      {
          "count": 10,
          "next": null,
          "previous": null,
          "results": [
               {
                   "user": "http://localhost/api/v2/users/admin/",
                   "user_uid": "u12345",
                   "username": "admin",
                   "action": "modify-user-permissions"
                   "metadata": {
                       "source": "Firefox (Ubuntu)",
                       "ip_address": "172.18.0.6",
                       "asset_uid": "a678910",
                       "log_subtype": "permissions",
                       "permissions":
                           {
                               "username": "user1",
                               "added": ["add_submissions", "view_submissions"],
                               "removed": ["change_asset"],
                           }
                   },
                   "date_created": "2024-08-19T16:48:58Z",
               },
               {
                   "user": "http://localhost/api/v2/users/admin/",
                   "user_uid": "u56789",
                   "username": "someuser",
                   "action": "update-settings",
                   "metadata": {
                       "source": "Firefox (Ubuntu)",
                       "ip_address": "172.18.0.6",
                       "asset_uid": a678910,
                       "log_subtype": "project",
                       "settings":
                           {
                               "description":
                                   {
                                       "old": "old_description",
                                       "new": "new_description",
                                   }
                               "countries":
                                   {
                                       "added": ["USA"],
                                       "removed": ["ALB"],
                                   }
                           }
                    },
                   "date_created": "2024-08-19T16:48:58Z",
               },
               ...
          ]
      }

Results from this endpoint can be filtered by a Boolean query specified in the q parameter.

Filterable fields for all project history logs:

    date_created

    user_uid

    user__*

    a. user__username

    b. user__email

    c. user__is_superuser

    metadata__*

    b. metadata__source

    c. metadata__ip_address

    d. metadata__asset_uid

    e. metadata__log_subtype
        available subtypes: "project", "permission"

    action

    available actions:

       add-media
       add-submission
       allow-anonymous-submissions
       archive
       clone-permissions
       connect-project
       delete-media
       delete-service
       delete-submission
       deploy
       disable-sharing
       disallow-anonymous-submissions
       disconnect-project
       enable-sharing
       export
       modify-imported-fields
       modify-qa-data
       modify-service
       modify-sharing
       modify-submission
       modify-user-permissions
       redeploy
       register-service
       replace-form
       share-data-publicly
       share-form-publicly
       transfer
       unarchive
       unshare-data-publicly
       unshare-form-publicly
       update-content
       update-name
       update-settings
       update-qa

Filterable fields by action:

    add-media

    a. metadata__asset-file__uid

    b. metadata__asset-file__filename

    add-submission

    a. metadata__submission__submitted_by

    b. metadata__submission__root_uuid

    archive

    a. metadata__latest_version_uid

    clone-permissions

    a. metadata__cloned_from

    connect-project

    a. metadata__paired-data__source_uid

    b. metadata__paired-data__source_name

    delete-media

    a. metadata__asset-file__uid

    b. metadata__asset-file__filename

    delete-service

    a. metadata__hook__uid

    b. metadata__hook__endpoint

    c. metadata__hook__active

    delete-submission

    a. metadata__submission__submitted_by

    b. metadata__submission__root_uuid

    deploy

    a. metadata__latest_version_uid

    b. metadata__latest_deployed_version_uid

    disconnect-project

    a. metadata__paired-data__source_uid

    b. metadata__paired-data__source_name

    modify-imported-fields

    a. metadata__paired-data__source_uid

    b. metadata__paired-data__source_name

    modify-qa-data

    a. metadata__submission__submitted_by

    b. metadata__submission__root_uuid

    modify-service

    a. metadata__hook__uid

    b. metadata__hook__endpoint

    c. metadata__hook__active

    modify-submission

    a. metadata__submission__submitted_by

    b. metadata__submission__root_uuid

    b. metadata__submission__status (only present if changed)

    modify-user-permissions

    a. metadata__permissions__username

    redeploy

    a. metadata__latest_version_uid

    b. metadata__latest_deployed_version_uid

    register-service

    a. metadata__hook__uid

    b. metadata__hook__endpoint

    c. metadata__hook__active

    transfer

    a. metadata__username

    unarchive

    a. metadata__latest_version_uid

    update-name

    a. metadata__name__old

    b. metadata__name__new

    update-settings

    a. metadata__settings__description__old

    b. metadata__settings__description__new

This endpoint can be paginated with 'offset' and 'limit' parameters.

