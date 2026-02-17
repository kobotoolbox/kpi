# API path prefixes that should be validated by the OpenAPI middleware
API_PATH_PREFIXES = (
    '/api/v2/',
    '/me/',
    '/environment/',
)

# Auto-generated constant. Do not edit by hand.
# Generated from CSV -> OPENAPI_VALIDATION_WHITELIST
OPENAPI_VALIDATION_WHITELIST = {
    'kobo/apps/audit_log/tests/api/v2/test_api_audit_log.py::ApiAuditLogTestCase::test_view_log_from_deleted_user': {
        'response-validation': {'^api/v2/audit-logs/$': ['GET']}
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_add_media_creates_log': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/files/$': ['POST']
        }
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_add_new_settings_creates_log': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']
        },
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']},
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_add_other_advanced_feature_does_not_create_log': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/advanced-features/$': ['POST']
        }
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_archive_creates_log': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/deployment/$': ['PATCH']
        }
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_bulk_actions': {
        'request-payload-validation': {'^api/v2/assets/bulk/$': ['POST']}
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_change_project_name_creates_log': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']
        },
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']},
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_change_standard_project_settings_creates_log': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']
        },
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']},
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_connect_project_creates_log': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/paired-data/$': ['POST']
        },
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/paired-data/$': ['POST']
        },
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_create_partial_permission_creates_log': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/permission-assignments/$': ['POST']
        },
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/permission-assignments/bulk/$': [
                'POST'
            ]
        },
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_disable_sharing_creates_log': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']
        },
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']},
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_enable_sharing_creates_log': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']
        },
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']},
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_export_creates_log': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/exports/$': ['POST']
        },
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/exports/$': ['POST']
        },
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_failed_add_qa_does_not_create_log': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/advanced-features/$': ['POST']
        }
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_failed_modify_qa_does_not_create_log': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/advanced-features/(?P<uid_advanced_feature>[^/.]+)/$': [
                'PATCH'
            ]
        }
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_falsy_field_creates_sharing_disabled_log': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']
        },
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']},
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_first_time_deployment_creates_log': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/deployment/$': ['POST']
        }
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_log_created_for_duplicate_submission': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/duplicate/$': [
                'POST'
            ]
        }
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_modify_service_creates_log': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/hooks/(?P<uid_hook>[^/.]+)/$': [
                'PATCH'
            ]
        }
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_modify_sharing_creates_log': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']
        },
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']},
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_multiple_submision_validation_statuses': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/validation_statuses/$': ['PATCH']
        }
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_no_log_created_for_non_project_transfer': {
        'response-validation': {'^api/v2/project-ownership/invites/$': ['POST']}
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_no_log_if_settings_unchanged': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']
        },
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']},
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_no_logs_if_bulk_request_fails': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/permission-assignments/bulk/$': [
                'POST'
            ]
        }
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_nullify_settings_creates_log': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']
        },
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']},
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_nullify_sharing_creates_sharing_disabled_log': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']
        },
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']},
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_redeployment_creates_log': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/deployment/$': ['PATCH']
        }
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_register_service_creates_log': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/hooks/$': ['POST']
        }
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_request_automatic_qa_data': {
        'request-payload-validation': {
            '^api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/': ['PATCH']
        },
        'response-validation': {
            '^api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/': ['PATCH']
        },
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_request_automatic_qa_data_bad_response': {
        'request-payload-validation': {
            '^api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/': ['PATCH']
        },
        'response-validation': {
            '^api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/': ['PATCH']
        },
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_request_automatic_qa_data_includes_backup_model_if_used': {
        'request-payload-validation': {
            '^api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/': ['PATCH']
        },
        'response-validation': {
            '^api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/': ['PATCH']
        },
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_transfer_creates_log': {
        'response-validation': {'^api/v2/project-ownership/invites/$': ['POST']}
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_transfer_multiple_creates_logs': {
        'response-validation': {'^api/v2/project-ownership/invites/$': ['POST']}
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_truthy_field_creates_sharing_enabled_log': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']
        },
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']},
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_unarchive_creates_log': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/deployment/$': ['PATCH']
        }
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_unchanged_settings_not_recorded_on_log': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']
        },
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']},
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_update_content_creates_log': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']
        },
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']},
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_update_multiple_submissions_content': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/bulk/$': ['PATCH']
        }
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_update_qa_creates_log': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']
        },
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']},
    },
    'kobo/apps/audit_log/tests/test_project_history_logs.py::TestProjectHistoryLogs::test_update_single_submission_validation_status': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/validation_status/$': [
                'PATCH'
            ]
        }
    },
    'kobo/apps/languages/tests/api/v2/test_api_languages.py::LanguageApiTestCase::test_can_read_as_anonymous_user': {
        'response-validation': {'^api/v2/languages/(?P<code>[^/.]+)/$': ['GET']}
    },
    'kobo/apps/languages/tests/api/v2/test_api_languages.py::LanguageApiTestCase::test_can_read_as_authenticated_user': {
        'response-validation': {'^api/v2/languages/(?P<code>[^/.]+)/$': ['GET']}
    },
    'kobo/apps/organizations/tests/test_organization_invitations.py::OrganizationInviteTestCase::test_admin_cannot_resend_invitation_if_not_pending': {
        'response-validation': {
            '^api/v2/organizations/(?P<uid_organization>[^/.]+)/invites/(?P<guid>[^/.]+)/$': [
                'PATCH'
            ]
        }
    },
    'kobo/apps/organizations/tests/test_organization_invitations.py::OrganizationInviteTestCase::test_registered_user_can_accept_invitation': {
        'request-payload-validation': {'^api/v2/assets/$': ['POST']},
        'response-validation': {
            '^api/v2/assets/$': ['POST'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET'],
        },
    },
    'kobo/apps/organizations/tests/test_organization_invitations.py::OrganizationInviteTestCase::test_registered_user_can_decline_invitation': {
        'request-payload-validation': {'^api/v2/assets/$': ['POST']},
        'response-validation': {
            '^api/v2/assets/$': ['POST'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET'],
        },
    },
    'kobo/apps/organizations/tests/test_organization_invitations.py::OrganizationInviteTestCase::test_user_can_cancel_invitation': {
        'response-validation': {
            '^api/v2/organizations/(?P<uid_organization>[^/.]+)/invites/(?P<guid>[^/.]+)/$': [
                'PATCH'
            ]
        }
    },
    'kobo/apps/organizations/tests/test_organization_invitations.py::OrganizationInviteTestCase::test_user_can_resend_invitation': {
        'response-validation': {
            '^api/v2/organizations/(?P<uid_organization>[^/.]+)/invites/(?P<guid>[^/.]+)/$': [
                'PATCH'
            ]
        }
    },
    'kobo/apps/organizations/tests/test_organization_invitations.py::OrganizationInviteTestCase::test_user_can_update_invitee_role': {
        'response-validation': {
            '^api/v2/organizations/(?P<uid_organization>[^/.]+)/invites/(?P<guid>[^/.]+)/$': [
                'PATCH'
            ]
        }
    },
    'kobo/apps/organizations/tests/test_organization_invitations.py::OrganizationInviteValidationTestCase::test_admin_can_reinvite_accepted_email': {
        'response-validation': {
            '^api/v2/organizations/(?P<uid_organization>[^/.]+)/invites/$': ['POST']
        }
    },
    'kobo/apps/organizations/tests/test_organization_invitations.py::OrganizationInviteValidationTestCase::test_admin_cannot_reinvite_active_or_accepted_username': {
        'response-validation': {
            '^api/v2/organizations/(?P<uid_organization>[^/.]+)/invites/$': ['POST']
        }
    },
    'kobo/apps/organizations/tests/test_organization_members_api.py::OrganizationMemberAPITestCase::test_inactive_user_do_not_show_up_members_list': {
        'response-validation': {
            '^api/v2/organizations/(?P<uid_organization>[^/.]+)/members/$': ['GET']
        }
    },
    'kobo/apps/organizations/tests/test_organization_members_api.py::OrganizationMemberAPITestCase::test_invitation_is_correctly_assigned_in_member_list': {
        'response-validation': {
            '^api/v2/organizations/(?P<uid_organization>[^/.]+)/members/$': ['GET']
        }
    },
    'kobo/apps/organizations/tests/test_organization_members_api.py::OrganizationMemberAPITestCase::test_invite_details_clear_after_user_removal': {
        'response-validation': {
            '^api/v2/organizations/(?P<uid_organization>[^/.]+)/members/(?P<username>[^/.]+)/$': [
                'GET'
            ]
        }
    },
    'kobo/apps/organizations/tests/test_organization_members_api.py::OrganizationMemberAPITestCase::test_list_members_with_different_roles': {
        'response-validation': {
            '^api/v2/organizations/(?P<uid_organization>[^/.]+)/members/$': ['GET']
        }
    },
    'kobo/apps/organizations/tests/test_organization_members_api.py::OrganizationMemberAPITestCase::test_retrieve_member_details_with_different_roles': {
        'response-validation': {
            '^api/v2/organizations/(?P<uid_organization>[^/.]+)/members/(?P<username>[^/.]+)/$': [
                'GET'
            ]
        }
    },
    'kobo/apps/organizations/tests/test_organization_members_api.py::OrganizationMemberAPITestCase::test_update_member_role_with_different_roles': {
        'response-validation': {
            '^api/v2/organizations/(?P<uid_organization>[^/.]+)/members/(?P<username>[^/.]+)/$': [
                'PATCH'
            ]
        }
    },
    'kobo/apps/organizations/tests/test_organizations_api.py::OrganizationAdminsDataApiTestCase::test_can_access_data': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/$': ['GET'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/$': ['GET'],
        }
    },
    'kobo/apps/organizations/tests/test_organizations_api.py::OrganizationAdminsDataApiTestCase::test_can_bulk_delete_data': {
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/data/$': ['GET']}
    },
    'kobo/apps/organizations/tests/test_organizations_api.py::OrganizationAdminsDataApiTestCase::test_can_delete_data': {
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/data/$': ['GET']}
    },
    'kobo/apps/organizations/tests/test_organizations_api.py::OrganizationAdminsDataApiTestCase::test_can_get_edit_link': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/enketo/edit/$': [
                'GET'
            ]
        }
    },
    'kobo/apps/organizations/tests/test_organizations_api.py::OrganizationAdminsDataApiTestCase::test_can_get_view_link': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/enketo/view/$': [
                'GET'
            ]
        }
    },
    'kobo/apps/organizations/tests/test_organizations_api.py::OrganizationAdminsRestServiceApiTestCase::test_can_list_rest_services': {
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/hooks/$': ['GET']}
    },
    'kobo/apps/organizations/tests/test_organizations_api.py::OrganizationAdminsRestServiceApiTestCase::test_can_update_rest_services': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/hooks/(?P<uid_hook>[^/.]+)/$': [
                'PATCH'
            ]
        }
    },
    'kobo/apps/organizations/tests/test_organizations_api.py::OrganizationAdminsValidationStatusApiTestCase::test_can_access_validation_status': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/$': ['GET'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/validation_status/$': [
                'GET'
            ],
        }
    },
    'kobo/apps/organizations/tests/test_organizations_api.py::OrganizationAdminsValidationStatusApiTestCase::test_can_bulk_delete_statuses': {
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/data/$': ['GET']}
    },
    'kobo/apps/organizations/tests/test_organizations_api.py::OrganizationAdminsValidationStatusApiTestCase::test_can_bulk_validate_statuses': {
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/data/$': ['GET']}
    },
    'kobo/apps/organizations/tests/test_organizations_api.py::OrganizationAdminsValidationStatusApiTestCase::test_can_delete_validation_status': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/validation_status/$': [
                'GET',
                'PATCH',
            ]
        }
    },
    'kobo/apps/organizations/tests/test_organizations_api.py::OrganizationAdminsValidationStatusApiTestCase::test_can_update_validation_status': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/validation_status/$': [
                'GET',
                'PATCH',
            ]
        }
    },
    'kobo/apps/organizations/tests/test_organizations_api.py::OrganizationAssetDetailApiTestCase::test_can_archive_or_unarchive_project': {
        'request-payload-validation': {'^api/v2/assets/$': ['POST']},
        'response-validation': {
            '^api/v2/assets/$': ['POST'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/deployment/$': ['PATCH'],
        },
    },
    'kobo/apps/organizations/tests/test_organizations_api.py::OrganizationAssetDetailApiTestCase::test_can_assign_permissions': {
        'request-payload-validation': {'^api/v2/assets/$': ['POST']},
        'response-validation': {
            '^api/v2/assets/$': ['POST'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET'],
        },
    },
    'kobo/apps/organizations/tests/test_organizations_api.py::OrganizationAssetDetailApiTestCase::test_can_delete_asset': {
        'request-payload-validation': {'^api/v2/assets/$': ['POST']},
        'response-validation': {
            '^api/v2/assets/$': ['POST'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET'],
        },
    },
    'kobo/apps/organizations/tests/test_organizations_api.py::OrganizationAssetDetailApiTestCase::test_can_update_asset': {
        'request-payload-validation': {'^api/v2/assets/$': ['POST']},
        'response-validation': {
            '^api/v2/assets/$': ['POST'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET', 'PATCH'],
        },
    },
    'kobo/apps/organizations/tests/test_organizations_api.py::OrganizationAssetDetailApiTestCase::test_create_asset_is_owned_by_organization': {
        'request-payload-validation': {'^api/v2/assets/$': ['POST']},
        'response-validation': {
            '^api/v2/assets/$': ['POST'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET'],
        },
    },
    'kobo/apps/organizations/tests/test_organizations_api.py::OrganizationAssetDetailApiTestCase::test_get_asset_detail': {
        'request-payload-validation': {'^api/v2/assets/$': ['POST']},
        'response-validation': {
            '^api/v2/assets/$': ['POST'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET'],
        },
    },
    'kobo/apps/organizations/tests/test_organizations_api.py::OrganizationAssetListApiTestCase::test_can_list': {
        'response-validation': {
            '^api/v2/organizations/(?P<uid_organization>[^/.]+)/assets/$': ['GET']
        }
    },
    'kobo/apps/organizations/tests/test_organizations_api.py::OrganizationAssetListApiTestCase::test_list_only_organization_assets': {
        'request-payload-validation': {'^api/v2/assets/$': ['POST']},
        'response-validation': {
            '^api/v2/assets/$': ['GET', 'POST'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET'],
            '^api/v2/organizations/(?P<uid_organization>[^/.]+)/assets/$': ['GET'],
        },
    },
    'kobo/apps/organizations/tests/test_organizations_api.py::OrganizationDetailAPITestCase::test_asset_usage': {
        'response-validation': {
            '^api/v2/organizations/(?P<uid_organization>[^/.]+)/asset_usage/$': ['GET']
        }
    },
    'kobo/apps/organizations/tests/test_organizations_service_usage_api.py::OrganizationServiceUsageAPITestCase::test_check_api_response_with_stripe': {
        'response-validation': {'^api/v2/service_usage/$': ['GET']}
    },
    'kobo/apps/project_ownership/tests/api/v2/test_api.py::ProjectOwnershipAPITestCase::test_can_create_invite_as_asset_owner': {
        'response-validation': {'^api/v2/project-ownership/invites/$': ['POST']}
    },
    'kobo/apps/project_ownership/tests/api/v2/test_api.py::ProjectOwnershipAPITestCase::test_cannot_create_bulk_invite_with_not_all_own_assets': {
        'response-validation': {'^api/v2/project-ownership/invites/$': ['POST']}
    },
    'kobo/apps/project_ownership/tests/api/v2/test_api.py::ProjectOwnershipAPITestCase::test_cannot_create_invite_as_regular_user': {
        'response-validation': {'^api/v2/project-ownership/invites/$': ['POST']}
    },
    'kobo/apps/project_ownership/tests/api/v2/test_api.py::ProjectOwnershipAPITestCase::test_cannot_create_invite_for_member_of_same_organization': {
        'response-validation': {'^api/v2/project-ownership/invites/$': ['POST']}
    },
    'kobo/apps/project_ownership/tests/api/v2/test_api.py::ProjectOwnershipInAppMessageAPITestCase::test_new_owner_do_not_receive_in_app_message': {
        'response-validation': {'^api/v2/project-ownership/invites/$': ['POST']}
    },
    'kobo/apps/project_ownership/tests/api/v2/test_api.py::ProjectOwnershipInAppMessageAPITestCase::test_other_users_do_not_receive_in_app_message': {
        'response-validation': {'^api/v2/project-ownership/invites/$': ['POST']}
    },
    'kobo/apps/project_ownership/tests/api/v2/test_api.py::ProjectOwnershipInAppMessageAPITestCase::test_previous_owner_do_not_receive_in_app_message': {
        'response-validation': {'^api/v2/project-ownership/invites/$': ['POST']}
    },
    'kobo/apps/project_ownership/tests/api/v2/test_api.py::ProjectOwnershipInAppMessageAPITestCase::test_shared_users_receive_in_app_message': {
        'response-validation': {'^api/v2/project-ownership/invites/$': ['POST']}
    },
    'kobo/apps/project_ownership/tests/api/v2/test_api.py::ProjectOwnershipInviteAPITestCase::test_can_accept_invite_as_recipient': {
        'response-validation': {
            '^api/v2/project-ownership/invites/(?P<uid_invite>[^/.]+)/$': ['PATCH']
        }
    },
    'kobo/apps/project_ownership/tests/api/v2/test_api.py::ProjectOwnershipInviteAPITestCase::test_can_cancel_invite_as_sender': {
        'response-validation': {
            '^api/v2/project-ownership/invites/(?P<uid_invite>[^/.]+)/$': ['PATCH']
        }
    },
    'kobo/apps/project_ownership/tests/api/v2/test_api.py::ProjectOwnershipInviteAPITestCase::test_can_decline_invite_as_recipient': {
        'response-validation': {
            '^api/v2/project-ownership/invites/(?P<uid_invite>[^/.]+)/$': ['PATCH']
        }
    },
    'kobo/apps/project_ownership/tests/api/v2/test_api.py::ProjectOwnershipInviteAPITestCase::test_cannot_change_complete_invite': {
        'response-validation': {
            '^api/v2/project-ownership/invites/(?P<uid_invite>[^/.]+)/$': ['PATCH']
        }
    },
    'kobo/apps/project_ownership/tests/api/v2/test_api.py::ProjectOwnershipInviteAPITestCase::test_cannot_change_expired_invite': {
        'response-validation': {
            '^api/v2/project-ownership/invites/(?P<uid_invite>[^/.]+)/$': ['PATCH']
        }
    },
    'kobo/apps/project_ownership/tests/api/v2/test_api.py::ProjectOwnershipInviteAPITestCase::test_cannot_change_failed_invite': {
        'response-validation': {
            '^api/v2/project-ownership/invites/(?P<uid_invite>[^/.]+)/$': ['PATCH']
        }
    },
    'kobo/apps/project_ownership/tests/api/v2/test_api.py::ProjectOwnershipInviteAPITestCase::test_cannot_change_in_progress_invite': {
        'response-validation': {
            '^api/v2/project-ownership/invites/(?P<uid_invite>[^/.]+)/$': ['PATCH']
        }
    },
    'kobo/apps/project_ownership/tests/api/v2/test_api.py::ProjectOwnershipInviteAPITestCase::test_invite_set_as_cancelled_on_project_deletion': {
        'response-validation': {
            '^api/v2/project-ownership/invites/(?P<uid_invite>[^/.]+)/$': ['GET']
        }
    },
    'kobo/apps/project_ownership/tests/api/v2/test_api.py::ProjectOwnershipTransferDataAPITestCase::test_account_usage_transferred_to_new_user': {
        'response-validation': {
            '^api/v2/project-ownership/invites/$': ['POST'],
            '^api/v2/service_usage/$': ['GET'],
        }
    },
    'kobo/apps/project_ownership/tests/api/v2/test_api.py::ProjectOwnershipTransferDataAPITestCase::test_data_accessible_to_new_user': {
        'response-validation': {'^api/v2/project-ownership/invites/$': ['POST']}
    },
    'kobo/apps/project_ownership/tests/api/v2/test_api.py::ProjectOwnershipTransferDataAPITestCase::test_mongo_uuid_after_transfer': {
        'response-validation': {'^api/v2/project-ownership/invites/$': ['POST']}
    },
    'kobo/apps/project_ownership/tests/api/v2/test_api.py::ProjectOwnershipTransferDataAPITestCase::test_thumbnails_are_deleted_after_transfer': {
        'response-validation': {'^api/v2/project-ownership/invites/$': ['POST']}
    },
    'kobo/apps/project_ownership/tests/api/v2/test_api.py::ProjectOwnershipTransferDataAPITestCase::test_transfer_to_user_with_identical_id_string': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET'],
            '^api/v2/project-ownership/invites/$': ['POST'],
        }
    },
    'kobo/apps/project_ownership/tests/test_mail.py::ProjectOwnershipMailTestCase::test_recipient_as_org_member_receives_invite': {
        'response-validation': {'^api/v2/project-ownership/invites/$': ['POST']}
    },
    'kobo/apps/project_ownership/tests/test_mail.py::ProjectOwnershipMailTestCase::test_recipient_receives_invite': {
        'response-validation': {'^api/v2/project-ownership/invites/$': ['POST']}
    },
    'kobo/apps/project_ownership/tests/test_mail.py::ProjectOwnershipMailTestCase::test_sender_receives_new_owner_acceptance': {
        'response-validation': {
            '^api/v2/project-ownership/invites/(?P<uid_invite>[^/.]+)/$': ['PATCH']
        }
    },
    'kobo/apps/project_ownership/tests/test_mail.py::ProjectOwnershipMailTestCase::test_sender_receives_new_owner_refusal': {
        'response-validation': {
            '^api/v2/project-ownership/invites/(?P<uid_invite>[^/.]+)/$': ['PATCH']
        }
    },
    'kobo/apps/stripe/tests/test_customer_portal_api.py::TestCustomerPortalAPITestCase::test_needs_organization_id': {
        'response-validation': {'^api/v2/stripe/customer-portal': ['POST']}
    },
    'kobo/apps/stripe/tests/test_customer_portal_api.py::TestCustomerPortalAPITestCase::test_user_must_be_owner': {
        'response-validation': {'^api/v2/stripe/customer-portal': ['POST']}
    },
    'kobo/apps/stripe/tests/test_link_creation_api.py::TestCheckoutLinkAPITestCase::test_creates_organization': {
        'response-validation': {'^api/v2/stripe/checkout-link': ['POST']}
    },
    'kobo/apps/stripe/tests/test_link_creation_api.py::TestCheckoutLinkAPITestCase::test_generates_url_for_price_with_quantity': {
        'response-validation': {'^api/v2/stripe/checkout-link': ['POST']}
    },
    'kobo/apps/stripe/tests/test_link_creation_api.py::TestCheckoutLinkAPITestCase::test_generates_url_for_price_without_quantity': {
        'response-validation': {'^api/v2/stripe/checkout-link': ['POST']}
    },
    'kobo/apps/stripe/tests/test_modify_subscription_api.py::TestChangePlanAPITestCase::test_downgrades_subscription': {
        'response-validation': {'^api/v2/stripe/change-plan': ['GET']}
    },
    'kobo/apps/stripe/tests/test_modify_subscription_api.py::TestChangePlanAPITestCase::test_downgrades_subscription_with_quantity': {
        'response-validation': {'^api/v2/stripe/change-plan': ['GET']}
    },
    'kobo/apps/stripe/tests/test_modify_subscription_api.py::TestChangePlanAPITestCase::test_upgrades_subscription': {
        'response-validation': {'^api/v2/stripe/change-plan': ['GET']}
    },
    'kobo/apps/stripe/tests/test_modify_subscription_api.py::TestChangePlanAPITestCase::test_upgrades_subscription_with_quantity': {
        'response-validation': {'^api/v2/stripe/change-plan': ['GET']}
    },
    'kobo/apps/stripe/tests/test_product_api.py::ProductAPITestCase::test_product_list': {
        'response-validation': {'^api/v2/stripe/products/$': ['GET']}
    },
    'kobo/apps/stripe/tests/test_subscription_api.py::SubscriptionAPITestCase::test_get_endpoint': {
        'response-validation': {
            '^api/v2/stripe/subscriptions/$': ['GET'],
            '^api/v2/stripe/subscriptions/(?P<id>[^/.]+)/$': ['GET'],
        }
    },
    'kobo/apps/subsequences/tests/api/v2/test_api.py::SubmissionSupplementAPITestCase::test_cannot_set_value_with_automatic_actions': {
        'request-payload-validation': {
            '^api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/': ['PATCH']
        }
    },
    'kobo/apps/subsequences/tests/api/v2/test_api.py::SubmissionSupplementAPITestCase::test_get_submission_after_edit': {
        'response-validation': {
            '^api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/': ['GET']
        }
    },
    'kobo/apps/subsequences/tests/api/v2/test_api.py::SubmissionSupplementAPITestCase::test_get_submission_with_null_root_uuid': {
        'response-validation': {
            '^api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/': ['GET']
        }
    },
    'kobo/apps/subsequences/tests/api/v2/test_api.py::SubmissionSupplementAPITestCase::test_retrieve_does_migrate_data': {
        'response-validation': {
            '^api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/': ['GET']
        }
    },
    'kobo/apps/subsequences/tests/api/v2/test_api.py::SubmissionSupplementAPITestCase::test_valid_automatic_translation': {
        'response-validation': {
            '^api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/': ['PATCH']
        }
    },
    'kobo/apps/subsequences/tests/api/v2/test_api.py::SubmissionSupplementAPITestCase::test_valid_manual_translation': {
        'response-validation': {
            '^api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/': ['PATCH']
        }
    },
    'kobo/apps/subsequences/tests/api/v2/test_api.py::SubmissionSupplementAPIUsageLimitsTestCase::test_google_services_usage_limit_checks': {
        'response-validation': {
            '^api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/': ['PATCH']
        }
    },
    'kobo/apps/subsequences/tests/api/v2/test_api.py::SubmissionSupplementAPIValidationTestCase::test_cannot_delete_non_existent_automatic_transcription': {
        'request-payload-validation': {
            '^api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/': ['PATCH']
        }
    },
    'kobo/apps/subsequences/tests/api/v2/test_api.py::SubmissionSupplementAPIValidationTestCase::test_cannot_delete_non_existent_transcription': {
        'request-payload-validation': {
            '^api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/': ['PATCH']
        },
        'response-validation': {
            '^api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/': ['PATCH']
        },
    },
    'kobo/apps/subsequences/tests/api/v2/test_api.py::SubmissionSupplementAPIValidationTestCase::test_cannot_patch_if_action_is_invalid': {
        'request-payload-validation': {
            '^api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/': ['PATCH']
        }
    },
    'kobo/apps/subsequences/tests/api/v2/test_api.py::SubmissionSupplementAPIValidationTestCase::test_cannot_patch_with_invalid_payload': {
        'request-payload-validation': {
            '^api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/': ['PATCH']
        }
    },
    'kobo/apps/subsequences/tests/api/v2/test_api.py::SubmissionSupplementAPIValidationTestCase::test_cannot_translate_deleted_manual_transcription': {
        'request-payload-validation': {
            '^api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/': ['PATCH']
        },
        'response-validation': {
            '^api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/': ['PATCH']
        },
    },
    'kobo/apps/subsequences/tests/api/v2/test_api.py::SubmissionSupplementAPIValidationTestCase::test_translation_works_when_transcript_is_replaced_by_different_action': {
        'response-validation': {
            '^api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/': ['PATCH']
        }
    },
    'kobo/apps/subsequences/tests/api/v2/test_permissions.py::SubsequencePermissionTestCase::test_can_read': {
        'response-validation': {
            '^api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/': ['GET']
        }
    },
    'kobo/apps/subsequences/tests/api/v2/test_views.py::QuestionAdvancedFeatureViewSetTestCase::test_cannot_create_feature_with_invalid_params': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/advanced-features/$': ['POST']
        }
    },
    'kobo/apps/subsequences/tests/api/v2/test_views.py::QuestionAdvancedFeatureViewSetTestCase::test_cannot_update_feature_with_invalid_params': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/advanced-features/(?P<uid_advanced_feature>[^/.]+)/$': [
                'PATCH'
            ]
        },
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/advanced-features/(?P<uid_advanced_feature>[^/.]+)/$': [
                'PATCH'
            ]
        },
    },
    'kobo/apps/subsequences/tests/api/v2/test_views.py::QuestionAdvancedFeatureViewSetTestCase::test_create_advanced_features_fails_if_feature_exists_in_old_field': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/advanced-features/$': ['POST']
        }
    },
    'kobo/apps/subsequences/tests/test_automatic_bedrock_qual.py::TestBedrockAutomaticBedrockQual::test_update_supplement_api': {
        'request-payload-validation': {
            '^api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/': ['PATCH']
        },
        'response-validation': {
            '^api/v2/assets/<uid_asset>/data/<root_uuid>/supplement/': ['PATCH']
        },
    },
    'kobo/apps/trash_bin/tests/admin/test_attachment_trash_admin.py::AttachmentTrashAdminTestCase::test_put_back_action_updates_is_deleted_flag': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/$': ['GET']
        }
    },
    'kobo/apps/trash_bin/tests/storage_cleanup/test_attachment_cleanup.py::AttachmentCleanupTestCase::test_auto_delete_excess_attachments_user_exceeds_limit': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/$': ['GET']
        }
    },
    'kobo/apps/user_reports/tests/test_user_reports.py::UserReportsFilterAndOrderingTestCase::test_balances_nested_json_filter': {
        'response-validation': {'^api/v2/user-reports/$': ['GET']}
    },
    'kobo/apps/user_reports/tests/test_user_reports.py::UserReportsFilterAndOrderingTestCase::test_current_period_submissions_gte_and_lte_filters': {
        'response-validation': {'^api/v2/user-reports/$': ['GET']}
    },
    'kobo/apps/user_reports/tests/test_user_reports.py::UserReportsFilterAndOrderingTestCase::test_date_joined_gte_and_lte_filters': {
        'response-validation': {'^api/v2/user-reports/$': ['GET']}
    },
    'kobo/apps/user_reports/tests/test_user_reports.py::UserReportsFilterAndOrderingTestCase::test_email_prefix_filter': {
        'response-validation': {'^api/v2/user-reports/$': ['GET']}
    },
    'kobo/apps/user_reports/tests/test_user_reports.py::UserReportsFilterAndOrderingTestCase::test_storage_bytes_gte_and_lte_filters': {
        'response-validation': {'^api/v2/user-reports/$': ['GET']}
    },
    'kobo/apps/user_reports/tests/test_user_reports.py::UserReportsFilterAndOrderingTestCase::test_subscriptions_nested_json_filter': {
        'response-validation': {'^api/v2/user-reports/$': ['GET']}
    },
    'kobo/apps/user_reports/tests/test_user_reports.py::UserReportsFilterAndOrderingTestCase::test_username_prefix_filter': {
        'response-validation': {'^api/v2/user-reports/$': ['GET']}
    },
    'kobo/apps/user_reports/tests/test_user_reports.py::UserReportsViewSetAPITestCase::test_accepted_tos_field': {
        'response-validation': {'^api/v2/user-reports/$': ['GET']}
    },
    'kobo/apps/user_reports/tests/test_user_reports.py::UserReportsViewSetAPITestCase::test_account_restricted_field': {
        'response-validation': {'^api/v2/user-reports/$': ['GET']}
    },
    'kobo/apps/user_reports/tests/test_user_reports.py::UserReportsViewSetAPITestCase::test_last_updated_fallback_for_users_without_snapshot': {
        'response-validation': {'^api/v2/user-reports/$': ['GET']}
    },
    'kobo/apps/user_reports/tests/test_user_reports.py::UserReportsViewSetAPITestCase::test_list_view_succeeds_for_superuser': {
        'response-validation': {'^api/v2/user-reports/$': ['GET']}
    },
    'kobo/apps/user_reports/tests/test_user_reports.py::UserReportsViewSetAPITestCase::test_ordering_by_date_joined': {
        'response-validation': {'^api/v2/user-reports/$': ['GET']}
    },
    'kobo/apps/user_reports/tests/test_user_reports.py::UserReportsViewSetAPITestCase::test_organization_data_is_correctly_returned': {
        'response-validation': {'^api/v2/user-reports/$': ['GET']}
    },
    'kobo/apps/user_reports/tests/test_user_reports.py::UserReportsViewSetAPITestCase::test_service_usage_data_is_correctly_returned': {
        'response-validation': {'^api/v2/user-reports/$': ['GET']}
    },
    'kobo/apps/user_reports/tests/test_user_reports.py::UserReportsViewSetAPITestCase::test_service_usage_handles_unlimited_limits': {
        'response-validation': {'^api/v2/user-reports/$': ['GET']}
    },
    'kobo/apps/user_reports/tests/test_user_reports.py::UserReportsViewSetAPITestCase::test_social_accounts_are_not_duplicated_with_multiple_subscriptions': {
        'response-validation': {'^api/v2/user-reports/$': ['GET']}
    },
    'kobo/apps/user_reports/tests/test_user_reports.py::UserReportsViewSetAPITestCase::test_subscription_data_is_correctly_returned': {
        'response-validation': {'^api/v2/user-reports/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_asset_bulk_actions.py::AssetBulkArchiveAPITestCase::test_anonymous_cannot_archive_public': {
        'request-payload-validation': {'^api/v2/assets/bulk/$': ['POST']},
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET']},
    },
    'kpi/tests/api/v2/test_api_asset_bulk_actions.py::AssetBulkArchiveAPITestCase::test_archive_all_with_confirm_true': {
        'request-payload-validation': {'^api/v2/assets/bulk/$': ['POST']},
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET']},
    },
    'kpi/tests/api/v2/test_api_asset_bulk_actions.py::AssetBulkArchiveAPITestCase::test_archive_all_without_confirm_true': {
        'request-payload-validation': {'^api/v2/assets/bulk/$': ['POST']},
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET']},
    },
    'kpi/tests/api/v2/test_api_asset_bulk_actions.py::AssetBulkArchiveAPITestCase::test_other_user_cannot_archive_others_assets': {
        'request-payload-validation': {'^api/v2/assets/bulk/$': ['POST']},
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET']},
    },
    'kpi/tests/api/v2/test_api_asset_bulk_actions.py::AssetBulkArchiveAPITestCase::test_project_editor_cannot_archive_project': {
        'request-payload-validation': {'^api/v2/assets/bulk/$': ['POST']},
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET']},
    },
    'kpi/tests/api/v2/test_api_asset_bulk_actions.py::AssetBulkArchiveAPITestCase::test_project_manager_can_archive_project': {
        'request-payload-validation': {'^api/v2/assets/bulk/$': ['POST']},
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET']},
    },
    'kpi/tests/api/v2/test_api_asset_bulk_actions.py::AssetBulkArchiveAPITestCase::test_user_can_unarchive': {
        'request-payload-validation': {'^api/v2/assets/bulk/$': ['POST']},
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET']},
    },
    'kpi/tests/api/v2/test_api_asset_bulk_actions.py::AssetBulkArchiveAPITestCase::test_user_cannot_archive_drafts': {
        'request-payload-validation': {'^api/v2/assets/bulk/$': ['POST']}
    },
    'kpi/tests/api/v2/test_api_asset_bulk_actions.py::AssetBulkDeleteAPITestCase::test_anonymous_cannot_delete_public': {
        'request-payload-validation': {'^api/v2/assets/bulk/$': ['POST']},
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET']},
    },
    'kpi/tests/api/v2/test_api_asset_bulk_actions.py::AssetBulkDeleteAPITestCase::test_cannot_delete_all_assets_without_confirm_true': {
        'request-payload-validation': {'^api/v2/assets/bulk/$': ['POST']},
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET']},
    },
    'kpi/tests/api/v2/test_api_asset_bulk_actions.py::AssetBulkDeleteAPITestCase::test_delete_all_assets_with_confirm_true': {
        'request-payload-validation': {'^api/v2/assets/bulk/$': ['POST']}
    },
    'kpi/tests/api/v2/test_api_asset_bulk_actions.py::AssetBulkDeleteAPITestCase::test_delete_bulk_assets_for_one_user': {
        'request-payload-validation': {'^api/v2/assets/bulk/$': ['POST']},
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET']},
    },
    'kpi/tests/api/v2/test_api_asset_bulk_actions.py::AssetBulkDeleteAPITestCase::test_other_user_cannot_delete_others_assets': {
        'request-payload-validation': {'^api/v2/assets/bulk/$': ['POST']},
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET']},
    },
    'kpi/tests/api/v2/test_api_asset_bulk_actions.py::AssetBulkDeleteAPITestCase::test_superuser_can_undelete': {
        'request-payload-validation': {'^api/v2/assets/bulk/$': ['POST']},
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET']},
    },
    'kpi/tests/api/v2/test_api_asset_bulk_actions.py::AssetBulkDeleteAPITestCase::test_users_cannot_undelete': {
        'request-payload-validation': {'^api/v2/assets/bulk/$': ['POST']}
    },
    'kpi/tests/api/v2/test_api_asset_counts.py::UsageAPITestCase::test_count_endpoint_anonymous_user_public_access': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/counts/$': ['GET']
        }
    },
    'kpi/tests/api/v2/test_api_asset_counts.py::UsageAPITestCase::test_count_endpoint_another_with_perms': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/counts/$': ['GET']
        }
    },
    'kpi/tests/api/v2/test_api_asset_counts.py::UsageAPITestCase::test_count_endpoint_owner': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/counts/$': ['GET']
        }
    },
    'kpi/tests/api/v2/test_api_asset_permission_assignment.py::ApiAssetPermissionTestCase::test_inactive_users_cannot_receive_permissions': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/permission-assignments/$': ['POST']
        }
    },
    'kpi/tests/api/v2/test_api_asset_permission_assignment.py::ApiAssetPermissionTestCase::test_submission_assignments_ignored_for_non_survey_assets': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/permission-assignments/$': ['POST']
        }
    },
    'kpi/tests/api/v2/test_api_asset_permission_assignment.py::ApiBulkAssetPermissionTestCase::test_cannot_assign_permissions_to_owner': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/permission-assignments/bulk/$': [
                'POST'
            ]
        }
    },
    'kpi/tests/api/v2/test_api_asset_permission_assignment.py::ApiBulkAssetPermissionTestCase::test_implied_partial_permissions_are_retained': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/permission-assignments/bulk/$': [
                'POST'
            ]
        }
    },
    'kpi/tests/api/v2/test_api_asset_permission_assignment.py::ApiBulkAssetPermissionTestCase::test_inactive_users_cannot_receive_permissions': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/permission-assignments/bulk/$': [
                'POST'
            ]
        }
    },
    'kpi/tests/api/v2/test_api_asset_permission_assignment.py::ApiBulkAssetPermissionTestCase::test_no_assignments_saved_on_error': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/permission-assignments/bulk/$': [
                'POST'
            ]
        }
    },
    'kpi/tests/api/v2/test_api_asset_permission_assignment.py::ApiBulkAssetPermissionTestCase::test_partial_permission_grants_implied_view_asset': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/permission-assignments/bulk/$': [
                'POST'
            ]
        }
    },
    'kpi/tests/api/v2/test_api_asset_permission_assignment.py::ApiBulkAssetPermissionTestCase::test_partial_permission_invalid': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/permission-assignments/bulk/$': [
                'POST'
            ]
        }
    },
    'kpi/tests/api/v2/test_api_asset_permission_assignment.py::ApiBulkAssetPermissionTestCase::test_partial_permission_no_duplicate_with_complex_AND_filters': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/permission-assignments/bulk/$': [
                'POST'
            ]
        }
    },
    'kpi/tests/api/v2/test_api_asset_permission_assignment.py::ApiBulkAssetPermissionTestCase::test_partial_permission_no_duplicate_with_complex_OR_filters': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/permission-assignments/bulk/$': [
                'POST'
            ]
        }
    },
    'kpi/tests/api/v2/test_api_asset_permission_assignment.py::ApiBulkAssetPermissionTestCase::test_partial_permission_no_duplicate_with_simple_filter': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/permission-assignments/bulk/$': [
                'POST'
            ]
        }
    },
    'kpi/tests/api/v2/test_api_asset_permission_assignment.py::ApiBulkAssetPermissionTestCase::test_submission_assignments_ignored_for_non_survey_assets': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/permission-assignments/bulk/$': [
                'POST'
            ]
        }
    },
    'kpi/tests/api/v2/test_api_asset_snapshots.py::TestAssetSnapshotDetail::test_preview_with_global_form_disclaimer': {
        'request-payload-validation': {'^api/v2/asset_snapshots/$': ['POST']},
        'response-validation': {
            '^api/v2/asset_snapshots/$': ['POST'],
            '^api/v2/assets/$': ['POST'],
        },
    },
    'kpi/tests/api/v2/test_api_asset_snapshots.py::TestAssetSnapshotDetail::test_preview_with_hidden_global_form_disclaimer': {
        'request-payload-validation': {'^api/v2/asset_snapshots/$': ['POST']},
        'response-validation': {
            '^api/v2/asset_snapshots/$': ['POST'],
            '^api/v2/assets/$': ['POST'],
        },
    },
    'kpi/tests/api/v2/test_api_asset_snapshots.py::TestAssetSnapshotDetail::test_preview_with_multilanguages_form_and_global_disclaimer': {
        'request-payload-validation': {'^api/v2/asset_snapshots/$': ['POST']},
        'response-validation': {
            '^api/v2/asset_snapshots/$': ['POST'],
            '^api/v2/assets/$': ['POST'],
        },
    },
    'kpi/tests/api/v2/test_api_asset_snapshots.py::TestAssetSnapshotDetail::test_preview_with_multilanguages_form_and_hidden_disclaimer': {
        'request-payload-validation': {'^api/v2/asset_snapshots/$': ['POST']},
        'response-validation': {
            '^api/v2/asset_snapshots/$': ['POST'],
            '^api/v2/assets/$': ['POST'],
        },
    },
    'kpi/tests/api/v2/test_api_asset_snapshots.py::TestAssetSnapshotDetail::test_preview_with_multilanguages_form_and_overridden_disclaimer': {
        'request-payload-validation': {'^api/v2/asset_snapshots/$': ['POST']},
        'response-validation': {
            '^api/v2/asset_snapshots/$': ['POST'],
            '^api/v2/assets/$': ['POST'],
        },
    },
    'kpi/tests/api/v2/test_api_asset_snapshots.py::TestAssetSnapshotDetail::test_preview_with_overridden_form_disclaimer': {
        'request-payload-validation': {'^api/v2/asset_snapshots/$': ['POST']},
        'response-validation': {
            '^api/v2/asset_snapshots/$': ['POST'],
            '^api/v2/assets/$': ['POST'],
        },
    },
    'kpi/tests/api/v2/test_api_asset_snapshots.py::TestAssetSnapshotList::test_anon_can_access_snapshot_xml': {
        'request-payload-validation': {'^api/v2/asset_snapshots/$': ['POST']},
        'response-validation': {
            '^api/v2/asset_snapshots/$': ['POST'],
            '^api/v2/assets/$': ['POST'],
        },
    },
    'kpi/tests/api/v2/test_api_asset_snapshots.py::TestAssetSnapshotList::test_anonymous_can_create_snapshot_when_asset_shared_public': {
        'request-payload-validation': {'^api/v2/asset_snapshots/$': ['POST']},
        'response-validation': {
            '^api/v2/asset_snapshots/$': ['POST'],
            '^api/v2/assets/$': ['POST'],
        },
    },
    'kpi/tests/api/v2/test_api_asset_snapshots.py::TestAssetSnapshotList::test_asset_owner_can_access_snapshot': {
        'request-payload-validation': {'^api/v2/asset_snapshots/$': ['POST']},
        'response-validation': {
            '^api/v2/asset_snapshots/$': ['POST'],
            '^api/v2/asset_snapshots/(?P<uid_asset_snapshot>[^/.]+)/$': ['GET'],
            '^api/v2/assets/$': ['POST'],
        },
    },
    'kpi/tests/api/v2/test_api_asset_snapshots.py::TestAssetSnapshotList::test_create_asset_snapshot_from_asset': {
        'request-payload-validation': {'^api/v2/asset_snapshots/$': ['POST']},
        'response-validation': {
            '^api/v2/asset_snapshots/$': ['POST'],
            '^api/v2/assets/$': ['POST'],
        },
    },
    'kpi/tests/api/v2/test_api_asset_snapshots.py::TestAssetSnapshotList::test_create_asset_snapshot_from_source': {
        'request-payload-validation': {'^api/v2/asset_snapshots/$': ['POST']},
        'response-validation': {'^api/v2/asset_snapshots/$': ['POST']},
    },
    'kpi/tests/api/v2/test_api_asset_snapshots.py::TestAssetSnapshotList::test_create_two_asset_snapshots_from_source_and_asset': {
        'request-payload-validation': {'^api/v2/asset_snapshots/$': ['POST']},
        'response-validation': {
            '^api/v2/asset_snapshots/$': ['POST'],
            '^api/v2/assets/$': ['POST'],
        },
    },
    'kpi/tests/api/v2/test_api_asset_snapshots.py::TestAssetSnapshotList::test_head_requests_return_empty_responses': {
        'request-payload-validation': {'^api/v2/asset_snapshots/$': ['POST']},
        'response-validation': {
            '^api/v2/asset_snapshots/$': ['POST'],
            '^api/v2/assets/$': ['POST'],
        },
    },
    'kpi/tests/api/v2/test_api_asset_snapshots.py::TestAssetSnapshotList::test_other_user_cannot_access_snapshot': {
        'request-payload-validation': {'^api/v2/asset_snapshots/$': ['POST']},
        'response-validation': {
            '^api/v2/asset_snapshots/$': ['POST'],
            '^api/v2/assets/$': ['POST'],
        },
    },
    'kpi/tests/api/v2/test_api_asset_snapshots.py::TestAssetSnapshotList::test_owner_can_access_snapshot_from_source': {
        'request-payload-validation': {'^api/v2/asset_snapshots/$': ['POST']},
        'response-validation': {
            '^api/v2/asset_snapshots/$': ['POST'],
            '^api/v2/asset_snapshots/(?P<uid_asset_snapshot>[^/.]+)/$': ['GET'],
        },
    },
    'kpi/tests/api/v2/test_api_asset_snapshots.py::TestAssetSnapshotList::test_shared_user_can_access_snapshot': {
        'request-payload-validation': {'^api/v2/asset_snapshots/$': ['POST']},
        'response-validation': {
            '^api/v2/asset_snapshots/$': ['POST'],
            '^api/v2/asset_snapshots/(?P<uid_asset_snapshot>[^/.]+)/$': ['GET'],
            '^api/v2/assets/$': ['POST'],
        },
    },
    'kpi/tests/api/v2/test_api_asset_snapshots.py::TestAssetSnapshotList::test_xml_renderer': {
        'request-payload-validation': {'^api/v2/asset_snapshots/$': ['POST']},
        'response-validation': {
            '^api/v2/asset_snapshots/$': ['POST'],
            '^api/v2/assets/$': ['POST'],
        },
    },
    'kpi/tests/api/v2/test_api_asset_snapshots.py::TestAssetSnapshotList::test_xml_renderer_with_invalid_asset': {
        'response-validation': {
            '^api/v2/assets/$': ['POST'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET'],
        }
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetDeploymentTest::test_archive_asset': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/deployment/$': ['PATCH'],
        }
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetDeploymentTest::test_archive_asset_does_not_modify_date_deployed': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/deployment/$': ['PATCH']
        }
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetDeploymentTest::test_asset_deployment': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/deployment/$': ['POST'],
        }
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetDeploymentTest::test_asset_deployment_dates': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/deployment/$': ['PATCH'],
        }
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetDeploymentTest::test_asset_deployment_validation_error': {
        'request-payload-validation': {'^api/v2/assets/$': ['POST']},
        'response-validation': {
            '^api/v2/assets/$': ['POST'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/deployment/$': ['POST'],
        },
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetDeploymentTest::test_asset_deployment_with_sheet_name_Settings': {
        'request-payload-validation': {'^api/v2/assets/$': ['POST']},
        'response-validation': {
            '^api/v2/assets/$': ['POST'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/deployment/$': ['POST'],
        },
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetDeploymentTest::test_asset_redeployment': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']
        },
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/deployment/$': ['PATCH'],
        },
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetDeploymentTest::test_asset_redeployment_validation_error': {
        'request-payload-validation': {
            '^api/v2/assets/$': ['POST'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH'],
        },
        'response-validation': {
            '^api/v2/assets/$': ['POST'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/deployment/$': [
                'PATCH',
                'POST',
            ],
        },
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetDetailApiTests::test_analysis_form_json_with_nlp_actions': {
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetDetailApiTests::test_asset_exists': {
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetDetailApiTests::test_asset_has_deployment_data': {
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetDetailApiTests::test_asset_version_id_and_content_hash': {
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetDetailApiTests::test_assignable_permissions': {
        'request-payload-validation': {'^api/v2/assets/$': ['POST']},
        'response-validation': {
            '^api/v2/assets/$': ['POST'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET'],
        },
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetDetailApiTests::test_can_clone_asset': {
        'request-payload-validation': {'^api/v2/assets/$': ['POST']},
        'response-validation': {'^api/v2/assets/$': ['POST']},
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetDetailApiTests::test_can_clone_version_of_asset': {
        'request-payload-validation': {'^api/v2/assets/$': ['POST']},
        'response-validation': {'^api/v2/assets/$': ['POST']},
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetDetailApiTests::test_can_update_asset_settings': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']
        },
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']},
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetDetailApiTests::test_can_update_data_sharing': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']
        },
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']},
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetDetailApiTests::test_cannot_modified_last_modified_by': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']
        },
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']},
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetDetailApiTests::test_cannot_update_data_sharing_with_invalid_payload': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']
        },
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']},
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetDetailApiTests::test_deployed_version_pagination': {
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetDetailApiTests::test_map_custom_field': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']
        },
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET', 'PATCH']
        },
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetDetailApiTests::test_map_styles_field': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']
        },
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET', 'PATCH']
        },
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetDetailApiTests::test_ownership_transfer_status': {
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetDetailApiTests::test_report_custom_field': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']
        },
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET', 'PATCH']
        },
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetDetailApiTests::test_report_styles_field': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']
        },
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET', 'PATCH']
        },
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetDetailApiTests::test_report_submissions': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/reports/$': ['GET']
        }
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetDetailApiTests::test_submission_count': {
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetFileTest::test_create_files_with_no_methods': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/files/$': ['POST']
        }
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetFileTest::test_upload_form_media_bad_base64': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/files/$': ['POST']
        }
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetFileTest::test_upload_form_media_bad_mime_type': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/files/$': ['POST']
        }
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetFileTest::test_upload_form_media_bad_remote_url': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/files/$': ['POST']
        }
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetListApiTests::test_asset_list_matches_detail': {
        'request-payload-validation': {'^api/v2/assets/$': ['POST']},
        'response-validation': {'^api/v2/assets/$': ['GET', 'POST']},
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetListApiTests::test_asset_owner_label': {
        'request-payload-validation': {'^api/v2/assets/$': ['POST']},
        'response-validation': {'^api/v2/assets/$': ['GET', 'POST']},
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetListApiTests::test_assets_hash': {
        'request-payload-validation': {'^api/v2/assets/$': ['POST']},
        'response-validation': {'^api/v2/assets/$': ['POST']},
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetListApiTests::test_assets_ordering': {
        'response-validation': {'^api/v2/assets/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetListApiTests::test_assets_search_query': {
        'response-validation': {'^api/v2/assets/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetListApiTests::test_create_asset': {
        'request-payload-validation': {'^api/v2/assets/$': ['POST']},
        'response-validation': {'^api/v2/assets/$': ['POST']},
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetListApiTests::test_creator_permissions_on_import': {
        'request-payload-validation': {'^api/v2/assets/$': ['POST']},
        'response-validation': {
            '^api/v2/assets/$': ['POST'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH'],
        },
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetListApiTests::test_delete_asset': {
        'request-payload-validation': {'^api/v2/assets/$': ['POST']},
        'response-validation': {'^api/v2/assets/$': ['POST']},
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetListApiTests::test_last_modified_by_field_not_assigned': {
        'request-payload-validation': {'^api/v2/assets/$': ['POST']},
        'response-validation': {'^api/v2/assets/$': ['POST']},
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetListApiTests::test_list_can_load_with_desynchronized_assets': {
        'response-validation': {'^api/v2/assets/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetListApiTests::test_numeric_search_for_assets_does_not_crash': {
        'response-validation': {'^api/v2/assets/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetListApiTests::test_query_counts': {
        'request-payload-validation': {'^api/v2/assets/$': ['POST']},
        'response-validation': {'^api/v2/assets/$': ['GET', 'POST']},
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetProjectViewListApiTests::test_project_views_anotheruser_submission_count': {
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetProjectViewListApiTests::test_project_views_for_anotheruser': {
        'response-validation': {
            '^api/v2/project-views/(?P<uid_project_view>[^/.]+)/assets/$': ['GET']
        }
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetProjectViewListApiTests::test_project_views_for_anotheruser_can_change_metadata': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET', 'PATCH'],
            '^api/v2/project-views/(?P<uid_project_view>[^/.]+)/assets/$': ['GET'],
        }
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetProjectViewListApiTests::test_project_views_for_anotheruser_can_preview_form': {
        'response-validation': {
            '^api/v2/asset_snapshots/(?P<uid_asset_snapshot>[^/.]+)/$': ['GET'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET'],
        }
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetProjectViewListApiTests::test_project_views_for_anotheruser_can_view_all_asset_permission_assignments': {
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetProjectViewListApiTests::test_project_views_for_anotheruser_can_view_asset_detail': {
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetSettingsFieldTest::test_query_settings': {
        'response-validation': {'^api/v2/assets/$': ['GET', 'POST']}
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetVersionApiTests::test_asset_version': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/versions/$': ['GET'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/versions/(?P<uid_version>[^/.]+)/$': [
                'GET'
            ],
        }
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetVersionApiTests::test_asset_version_content_hash': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/versions/$': ['GET'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/versions/(?P<uid_version>[^/.]+)/$': [
                'GET'
            ],
        }
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetVersionApiTests::test_versions_public_access': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/versions/$': ['GET'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/versions/(?P<uid_version>[^/.]+)/$': [
                'GET'
            ],
        }
    },
    'kpi/tests/api/v2/test_api_assets.py::AssetVersionApiTests::test_view_access_to_version': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/versions/$': ['GET'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/versions/(?P<uid_version>[^/.]+)/$': [
                'GET'
            ],
        }
    },
    'kpi/tests/api/v2/test_api_attachments_delete_viewset.py::AttachmentDeleteApiTests::test_bulk_delete_attachments_empty_submission_root_uuid_list': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/attachments/bulk/$': ['DELETE']
        }
    },
    'kpi/tests/api/v2/test_api_attachments_delete_viewset.py::AttachmentDeleteApiTests::test_delete_single_attachment_invalid_uid': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/attachments/(?P<pk>[^/.]+)/$': [
                'DELETE'
            ]
        }
    },
    'kpi/tests/api/v2/test_api_collections.py::CollectionsTests::test_collection_cannot_subscribe_if_not_public': {
        'response-validation': {'^api/v2/asset_subscriptions/$': ['POST']}
    },
    'kpi/tests/api/v2/test_api_collections.py::CollectionsTests::test_collection_detail': {
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_collections.py::CollectionsTests::test_collection_filtered_list': {
        'response-validation': {'^api/v2/assets/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_collections.py::CollectionsTests::test_collection_list': {
        'response-validation': {'^api/v2/assets/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_collections.py::CollectionsTests::test_collection_rename': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET', 'PATCH']
        }
    },
    'kpi/tests/api/v2/test_api_collections.py::CollectionsTests::test_collection_statuses_and_access_types': {
        'response-validation': {'^api/v2/assets/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_collections.py::CollectionsTests::test_collection_subscribe': {
        'response-validation': {'^api/v2/assets/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_collections.py::CollectionsTests::test_collection_unsubscribe': {
        'response-validation': {'^api/v2/assets/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_collections.py::CollectionsTests::test_create_collection': {
        'request-payload-validation': {'^api/v2/assets/$': ['POST']},
        'response-validation': {'^api/v2/assets/$': ['POST']},
    },
    'kpi/tests/api/v2/test_api_collections.py::CollectionsTests::test_get_subscribed_collection': {
        'response-validation': {'^api/v2/assets/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_exports.py::AssetExportTaskTestV2::test_export_asset_with_slashes': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/exports/(?P<uid_export>[^/.]+)/$': [
                'GET'
            ]
        }
    },
    'kpi/tests/api/v2/test_api_exports.py::AssetExportTaskTestV2::test_synchronous_csv_export_matches_async_export': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/exports/(?P<uid_export>[^/.]+)/$': [
                'GET'
            ]
        }
    },
    'kpi/tests/api/v2/test_api_imports.py::AssetImportTaskTest::test_import_asset_base64_xls': {
        'response-validation': {'^api/v2/imports/(?P<uid_import>[^/.]+)/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_imports.py::AssetImportTaskTest::test_import_asset_from_xls_url': {
        'response-validation': {'^api/v2/imports/(?P<uid_import>[^/.]+)/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_imports.py::AssetImportTaskTest::test_import_asset_xls': {
        'response-validation': {'^api/v2/imports/(?P<uid_import>[^/.]+)/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_imports.py::AssetImportTaskTest::test_import_basic_survey_base64_xls': {
        'response-validation': {'^api/v2/assets/$': ['POST']}
    },
    'kpi/tests/api/v2/test_api_imports.py::AssetImportTaskTest::test_import_basic_survey_base64_xlsx': {
        'response-validation': {'^api/v2/assets/$': ['POST']}
    },
    'kpi/tests/api/v2/test_api_imports.py::AssetImportTaskTest::test_import_library_bulk_xls': {
        'response-validation': {'^api/v2/imports/(?P<uid_import>[^/.]+)/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_imports.py::AssetImportTaskTest::test_import_library_bulk_xlsx': {
        'response-validation': {'^api/v2/imports/(?P<uid_import>[^/.]+)/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_imports.py::AssetImportTaskTest::test_import_locking_xls_as_block': {
        'response-validation': {'^api/v2/assets/$': ['POST']}
    },
    'kpi/tests/api/v2/test_api_imports.py::AssetImportTaskTest::test_import_locking_xls_as_question': {
        'response-validation': {'^api/v2/assets/$': ['POST']}
    },
    'kpi/tests/api/v2/test_api_imports.py::AssetImportTaskTest::test_import_locking_xls_as_survey': {
        'response-validation': {'^api/v2/assets/$': ['POST']}
    },
    'kpi/tests/api/v2/test_api_imports.py::AssetImportTaskTest::test_import_locking_xls_as_survey_with_kobo_n_and_m_dash': {
        'response-validation': {'^api/v2/assets/$': ['POST']}
    },
    'kpi/tests/api/v2/test_api_imports.py::AssetImportTaskTest::test_import_non_xls_url': {
        'response-validation': {'^api/v2/imports/(?P<uid_import>[^/.]+)/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_imports.py::AssetImportTaskTest::test_import_strip_newline_from_form_title_setting': {
        'response-validation': {
            '^api/v2/assets/$': ['POST'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET'],
        }
    },
    'kpi/tests/api/v2/test_api_imports.py::AssetImportTaskTest::test_import_xls_with_default_language_but_no_translations': {
        'response-validation': {'^api/v2/imports/(?P<uid_import>[^/.]+)/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_imports.py::AssetImportTaskTest::test_import_xls_with_default_language_not_in_translations': {
        'response-validation': {'^api/v2/imports/(?P<uid_import>[^/.]+)/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_paired_data.py::PairedDataListApiTests::test_create_by_destination_editor': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/paired-data/$': ['POST'],
        },
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/paired-data/$': ['POST'],
        },
    },
    'kpi/tests/api/v2/test_api_paired_data.py::PairedDataListApiTests::test_create_paired_data_anonymous': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/paired-data/$': ['POST'],
        },
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH']},
    },
    'kpi/tests/api/v2/test_api_paired_data.py::PairedDataListApiTests::test_create_trivial_case': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/paired-data/$': ['POST'],
        },
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/paired-data/$': ['POST'],
        },
    },
    'kpi/tests/api/v2/test_api_paired_data.py::PairedDataListApiTests::test_create_with_already_used_filename': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/paired-data/$': ['POST'],
        },
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/paired-data/$': ['POST'],
        },
    },
    'kpi/tests/api/v2/test_api_paired_data.py::PairedDataListApiTests::test_create_with_invalid_fields': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/paired-data/$': ['POST'],
        },
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/paired-data/$': ['POST'],
        },
    },
    'kpi/tests/api/v2/test_api_paired_data.py::PairedDataListApiTests::test_create_with_invalid_filename': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/paired-data/$': ['POST'],
        },
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/paired-data/$': ['POST'],
        },
    },
    'kpi/tests/api/v2/test_api_paired_data.py::PairedDataListApiTests::test_create_with_invalid_source': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/paired-data/$': ['POST']
        },
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/paired-data/$': ['POST']
        },
    },
    'kpi/tests/api/v2/test_api_paired_data.py::PairedDataListApiTests::test_create_without_view_submission_permission': {
        'request-payload-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/paired-data/$': ['POST'],
        },
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['PATCH'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/paired-data/$': ['POST'],
        },
    },
    'kpi/tests/api/v2/test_api_permissions.py::ApiAnonymousPermissionsTestCase::test_anon_asset_detail': {
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_permissions.py::ApiAnonymousPermissionsTestCase::test_cannot_create_asset': {
        'request-payload-validation': {'^api/v2/assets/$': ['POST']}
    },
    'kpi/tests/api/v2/test_api_permissions.py::ApiPermissionsPublicAssetTestCase::test_public_asset_not_in_list_admin': {
        'response-validation': {'^api/v2/assets/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_permissions.py::ApiPermissionsPublicAssetTestCase::test_public_asset_not_in_list_user': {
        'response-validation': {'^api/v2/assets/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_permissions.py::ApiPermissionsPublicAssetTestCase::test_revoke_anon_from_asset_in_public_collection': {
        'response-validation': {
            '^api/v2/assets/$': ['POST'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET', 'PATCH'],
        }
    },
    'kpi/tests/api/v2/test_api_permissions.py::ApiPermissionsPublicAssetTestCase::test_user_can_view_public_asset': {
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_permissions.py::ApiPermissionsTestCase::test_cannot_copy_permissions_between_non_owned_assets': {
        'response-validation': {'^api/v2/assets/$': ['POST']}
    },
    'kpi/tests/api/v2/test_api_permissions.py::ApiPermissionsTestCase::test_copy_permissions_between_assets': {
        'response-validation': {'^api/v2/assets/$': ['POST']}
    },
    'kpi/tests/api/v2/test_api_permissions.py::ApiPermissionsTestCase::test_inherited_viewable_asset_not_deletable': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET', 'PATCH']
        }
    },
    'kpi/tests/api/v2/test_api_permissions.py::ApiPermissionsTestCase::test_inherited_viewable_assets_in_asset_list': {
        'response-validation': {
            '^api/v2/assets/$': ['GET'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET', 'PATCH'],
        }
    },
    'kpi/tests/api/v2/test_api_permissions.py::ApiPermissionsTestCase::test_inherited_viewable_collections_in_collection_list': {
        'response-validation': {
            '^api/v2/assets/$': ['GET'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET'],
        }
    },
    'kpi/tests/api/v2/test_api_permissions.py::ApiPermissionsTestCase::test_non_viewable_asset_inheritance_conflict': {
        'response-validation': {
            '^api/v2/assets/$': ['GET'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET', 'PATCH'],
        }
    },
    'kpi/tests/api/v2/test_api_permissions.py::ApiPermissionsTestCase::test_non_viewable_collection_inheritance_conflict': {
        'response-validation': {
            '^api/v2/assets/$': ['GET', 'POST'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET', 'PATCH'],
        }
    },
    'kpi/tests/api/v2/test_api_permissions.py::ApiPermissionsTestCase::test_own_asset_in_asset_list': {
        'response-validation': {
            '^api/v2/assets/$': ['GET'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET'],
        }
    },
    'kpi/tests/api/v2/test_api_permissions.py::ApiPermissionsTestCase::test_own_collection_in_collection_list': {
        'response-validation': {
            '^api/v2/assets/$': ['GET'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET'],
        }
    },
    'kpi/tests/api/v2/test_api_permissions.py::ApiPermissionsTestCase::test_shared_asset_manage_asset_remove_another_non_owners_permissions_allowed': {
        'response-validation': {'^api/v2/assets/$': ['POST']}
    },
    'kpi/tests/api/v2/test_api_permissions.py::ApiPermissionsTestCase::test_shared_asset_non_owner_remove_another_non_owners_permissions_not_allowed': {
        'response-validation': {'^api/v2/assets/$': ['POST']}
    },
    'kpi/tests/api/v2/test_api_permissions.py::ApiPermissionsTestCase::test_shared_asset_non_owner_remove_owners_permissions_not_allowed': {
        'response-validation': {'^api/v2/assets/$': ['POST']}
    },
    'kpi/tests/api/v2/test_api_permissions.py::ApiPermissionsTestCase::test_shared_asset_remove_own_permissions_allowed': {
        'response-validation': {'^api/v2/assets/$': ['POST']}
    },
    'kpi/tests/api/v2/test_api_permissions.py::ApiPermissionsTestCase::test_user_cannot_copy_permissions_from_non_viewable_asset': {
        'response-validation': {'^api/v2/assets/$': ['POST']}
    },
    'kpi/tests/api/v2/test_api_permissions.py::ApiPermissionsTestCase::test_user_cannot_copy_permissions_to_non_editable_asset': {
        'response-validation': {'^api/v2/assets/$': ['POST']}
    },
    'kpi/tests/api/v2/test_api_permissions.py::ApiPermissionsTestCase::test_viewable_asset_in_asset_list': {
        'response-validation': {
            '^api/v2/assets/$': ['GET'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET'],
        }
    },
    'kpi/tests/api/v2/test_api_permissions.py::ApiPermissionsTestCase::test_viewable_asset_inheritance_conflict': {
        'response-validation': {
            '^api/v2/assets/$': ['GET'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET', 'PATCH'],
        }
    },
    'kpi/tests/api/v2/test_api_permissions.py::ApiPermissionsTestCase::test_viewable_collection_in_collection_list': {
        'response-validation': {
            '^api/v2/assets/$': ['GET'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET'],
        }
    },
    'kpi/tests/api/v2/test_api_permissions.py::ApiPermissionsTestCase::test_viewable_collection_inheritance_conflict': {
        'response-validation': {
            '^api/v2/assets/$': ['GET', 'POST'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET', 'PATCH'],
        }
    },
    'kpi/tests/api/v2/test_api_service_usage.py::ServiceUsageAPITestCase::test_check_api_response': {
        'response-validation': {'^api/v2/service_usage/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_service_usage.py::ServiceUsageAPITestCase::test_multiple_forms': {
        'response-validation': {'^api/v2/service_usage/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_service_usage.py::ServiceUsageAPITestCase::test_no_data': {
        'response-validation': {'^api/v2/service_usage/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_service_usage.py::ServiceUsageAPITestCase::test_no_deployment': {
        'response-validation': {'^api/v2/service_usage/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_service_usage.py::ServiceUsageAPITestCase::test_service_usages_with_projects_in_trash_bin': {
        'response-validation': {'^api/v2/service_usage/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_submissions.py::SubmissionEditApiTests::test_edit_submission_with_different_root_name': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/enketo/edit/$': [
                'GET'
            ]
        }
    },
    'kpi/tests/api/v2/test_api_submissions.py::SubmissionEditApiTests::test_edit_submission_with_xml_encoding_declaration': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/enketo/edit/$': [
                'GET'
            ]
        }
    },
    'kpi/tests/api/v2/test_api_submissions.py::SubmissionEditApiTests::test_edit_submission_with_xml_missing_uuids': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/enketo/edit/$': [
                'GET'
            ]
        }
    },
    'kpi/tests/api/v2/test_api_submissions.py::SubmissionEditApiTests::test_get_edit_link_response_includes_csrf_cookie': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/enketo/edit/$': [
                'GET'
            ]
        }
    },
    'kpi/tests/api/v2/test_api_submissions.py::SubmissionEditApiTests::test_get_edit_link_submission_as_owner': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/enketo/edit/$': [
                'GET'
            ]
        }
    },
    'kpi/tests/api/v2/test_api_submissions.py::SubmissionEditApiTests::test_get_edit_link_submission_shared_with_edit_as_anotheruser': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/enketo/edit/$': [
                'GET'
            ]
        }
    },
    'kpi/tests/api/v2/test_api_submissions.py::SubmissionEditApiTests::test_get_edit_link_submission_with_latest_asset_deployment': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/enketo/edit/$': [
                'GET'
            ]
        }
    },
    'kpi/tests/api/v2/test_api_submissions.py::SubmissionEditApiTests::test_get_edit_link_with_partial_perms_as_anotheruser': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/enketo/edit/$': [
                'GET'
            ]
        }
    },
    'kpi/tests/api/v2/test_api_submissions.py::SubmissionEditApiTests::test_get_legacy_edit_link_submission_as_owner': {
        'response-validation': {'^api/v2/assets/<uid_asset>/data/<pk>/edit/': ['GET']}
    },
    'kpi/tests/api/v2/test_api_submissions.py::SubmissionEditApiTests::test_get_multiple_edit_links_and_attempt_submit_edits': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/enketo/edit/$': [
                'GET'
            ]
        }
    },
    'kpi/tests/api/v2/test_api_submissions.py::SubmissionGeoJsonApiTests::test_list_submissions_geojson_defaults': {
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/data/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_submissions.py::SubmissionGeoJsonApiTests::test_list_submissions_geojson_other_geo_question': {
        'response-validation': {'^api/v2/assets/(?P<uid_asset>[^/.]+)/data/$': ['GET']}
    },
    'kpi/tests/api/v2/test_api_submissions.py::SubmissionValidationStatusApiTests::test_delete_status_as_owner': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/validation_status/$': [
                'GET',
                'PATCH',
            ]
        }
    },
    'kpi/tests/api/v2/test_api_submissions.py::SubmissionValidationStatusApiTests::test_delete_status_of_shared_submission_as_anotheruser': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/validation_status/$': [
                'GET'
            ]
        }
    },
    'kpi/tests/api/v2/test_api_submissions.py::SubmissionValidationStatusApiTests::test_edit_status_as_owner': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/validation_status/$': [
                'GET',
                'PATCH',
            ]
        }
    },
    'kpi/tests/api/v2/test_api_submissions.py::SubmissionValidationStatusApiTests::test_edit_status_of_shared_submission_as_anotheruser': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/validation_status/$': [
                'GET',
                'PATCH',
            ]
        }
    },
    'kpi/tests/api/v2/test_api_submissions.py::SubmissionValidationStatusApiTests::test_edit_status_with_partial_perms_as_anotheruser': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/validation_status/$': [
                'GET',
                'PATCH',
            ]
        }
    },
    'kpi/tests/api/v2/test_api_submissions.py::SubmissionValidationStatusApiTests::test_retrieve_status_as_owner': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/validation_status/$': [
                'GET'
            ]
        }
    },
    'kpi/tests/api/v2/test_api_submissions.py::SubmissionValidationStatusApiTests::test_retrieve_status_of_shared_submission_as_anotheruser': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/validation_status/$': [
                'GET'
            ]
        }
    },
    'kpi/tests/api/v2/test_api_submissions.py::SubmissionValidationStatusesApiTests::test_submitted_by_persists_when_validation_status_updated': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/validation_status/$': [
                'PATCH'
            ]
        }
    },
    'kpi/tests/api/v2/test_api_submissions.py::SubmissionViewApiTests::test_get_view_link_submission_as_owner': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/enketo/view/$': [
                'GET'
            ]
        }
    },
    'kpi/tests/api/v2/test_api_submissions.py::SubmissionViewApiTests::test_get_view_link_submission_shared_with_view_only_as_anotheruser': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/enketo/view/$': [
                'GET'
            ]
        }
    },
    'kpi/tests/api/v2/test_api_submissions.py::SubmissionViewApiTests::test_get_view_link_with_partial_perms_as_anotheruser': {
        'response-validation': {
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/data/(?P<pk>[^/.]+)/enketo/view/$': [
                'GET'
            ]
        }
    },
    'kpi/tests/test_assets.py::TestAssetExcludedFromProjectsListFlag::test_asset_is_excluded_from_projects_list_flag': {
        'request-payload-validation': {'^api/v2/assets/$': ['POST']},
        'response-validation': {
            '^api/v2/assets/$': ['POST'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET'],
            '^api/v2/project-ownership/invites/(?P<uid_invite>[^/.]+)/$': ['PATCH'],
        },
    },
    'kpi/tests/test_assets.py::TestAssetExcludedFromProjectsListFlag::test_asset_visibility_after_transfer': {
        'request-payload-validation': {'^api/v2/assets/$': ['POST']},
        'response-validation': {
            '^api/v2/assets/$': ['GET', 'POST'],
            '^api/v2/assets/(?P<uid_asset>[^/.]+)/$': ['GET'],
            '^api/v2/organizations/(?P<uid_organization>[^/.]+)/assets/$': ['GET'],
        },
    },
}
