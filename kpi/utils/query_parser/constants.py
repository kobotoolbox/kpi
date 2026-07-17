from kpi.type_aliases import LookupFieldsMap

DENY_ALL = frozenset({'*'})  # Deny all fields in the table

# LLM Prompt used to generate this allowlist:
#
# Generate a dictionary of allowed fields for each model in KoboToolbox KPI's q search.
# The list must cover paths used by real searches (e.g. owner__username, parent__uid,
# asset_type, summary__icontains, the status special-case, JSONField roots like
# settings, summary, extra_details__data, etc.). Keep the uniform-rejection behavior
# for disallowed paths. Only whitelist explicitly what is allowed. Make a comprehensive
# search across the codebase for all instances of SearchFilter to identify any views
# that use the query parser in order to make sure we don't miss anything. The list will
# be maintained in `kpi.utils.query_parser.constants.ALLOWED_LOOKUP_FIELDS`. The idea is
# to block sensitive data from being used with search filters.
# NOTE: The prompt should search for overrides, readmes, openapi docs, js/ts files.
# When inspecting frontend TS/JS files for potential filters, you should look broadly
# for patterns where parameters are mapped to the backend `q` query string.
# Check for properties like `apiFilteringName` (e.g. in `projectViews/constants.ts`),
# `filterBy` (e.g. `summary__languages__icontains` in `assetsTableConstants.ts`),
# or how things like `SearchAssetsPredefinedParams.filterProperty` are constructed.
#
# OVERRIDING / AUGMENTING:
# If you need to expose fields for a specific DRF ViewSet that shouldn't be allowed
# globally, you can define `allowed_lookup_fields_override` on the ViewSet.
# It should be a dictionary mapping model labels to a set of field names. For example:
#     allowed_lookup_fields_override = {
#         'kpi.asset': {'deployment'}
#     }
#
# Granularity is at the explicit model level.
# ```
# ALLOWED_LOOKUP_FIELDS = {
#     'app_label.model_name': {'field1', 'field2', ...},
#     ...
# }
# ```

ALLOWED_LOOKUP_FIELDS: LookupFieldsMap = {
    'audit_log.accesslog': frozenset({
        'action',
        'date_created',
        'metadata',
        'user',
    }),
    'audit_log.auditlog': frozenset({
        'action',
        'date_created',
        'metadata',
        'user',
    }),
    'audit_log.projecthistorylog': frozenset({
        'action',
        'date_created',
        'metadata',
        'user',
    }),
    'hub.extrauserdetail': frozenset({
        'data',
        'uid',
    }),
    'kobo_auth.user': frozenset({
        'extra_details',   # To allow extra_details__data
        'organizations_organization',  # To allow organizations_organization__name
        'username',
    }),
    'kpi.asset': frozenset({
        '_deployment_status',
        '_deployment_data',
        'asset_type',
        'date_created',
        'date_deployed',
        'date_modified',
        'name',
        'owner',
        'parent',
        'search_field',
        'settings',
        'status',          # Special-cased in code, but good to whitelist explicitly
        'summary',
        'tags',
        'uid',
        'data_sharing',    # To allow data_sharing__enabled
        'last_modified_by',
    }),
    'kpi.importtask': frozenset({
        'data',
        'date_created',
        'status',
        'user',
        'uid',
    }),
    'kpi.submissionexporttask': frozenset({
        'data',
        'date_created',
        'status',
        'user',
        'uid',
    }),
    'kpi.submissionsynchronousexport': frozenset({
        'data',
        'date_created',
        'status',
        'user',
        'uid',
    }),
    'kpi.userassetsubscription': frozenset({
        'id',
        'status',
        'subscribed_date',
        'uid',
    }),
    'languages.language': frozenset({
        'code',
        'name',
        'featured',
        'transcription_services',
        'translation_services',
    }),
    'languages.transcriptionservice': frozenset({
        'code',
        'name',
    }),
    'languages.translationservice': frozenset({
        'code',
        'name',
    }),
    'organizations.organization': frozenset({
        'name',
        'slug',
        'website',
    }),
    'project_views.projectview': frozenset({
        'name',
        'countries',
        'organizations',
        'permissions',
        'users',
        'uid',
    }),
    'user_reports.userreports': frozenset({
        'username',
        'first_name',
        'last_name',
    }),
    'taggit.tag': frozenset({
        'name',
    }),
}
# The denylist is kept purely as documentation and does not participate in runtime
# authorization. It records what is explicitly banned and why.
DENIED_LOOKUP_FIELDS: LookupFieldsMap = {
    # Models that must NEVER be traversed to protect sensitive data
    # (e.g., tokens, credentials):
    'account.emailconfirmation': DENY_ALL,
    'accounts_mfa.mfamethodswrapper': DENY_ALL,
    'authtoken.token': DENY_ALL,
    'django_digest.partialdigest': DENY_ALL,
    'mfa.authenticator': DENY_ALL,
    'socialaccount.socialaccount': DENY_ALL,
    'socialaccount.socialtoken': DENY_ALL,
    'socialaccount.socialapp': DENY_ALL,

    # --- Partially allowed models (missing fields denied) ---
    'audit_log.accesslog': frozenset({
        'app_label',  # Internal system data
        'id',  # Internal system data
        'log_type',  # Internal system data
        'model_name',  # Internal system data
        'object_id',  # Internal system data
        'object_id_legacy',  # Internal system data
        'user_id',  # Internal system data
        'user_uid',  # Internal system data
    }),
    'audit_log.auditlog': frozenset({
        'app_label',  # Internal system data
        'id',  # Internal system data
        'log_type',  # Internal system data
        'model_name',  # Internal system data
        'object_id',  # Internal system data
        'object_id_legacy',  # Internal system data
        'user_id',  # Internal system data
        'user_uid',  # Internal system data
    }),
    'audit_log.projecthistorylog': frozenset({
        'app_label',  # Internal system data
        'id',  # Internal system data
        'log_type',  # Internal system data
        'model_name',  # Internal system data
        'object_id',  # Internal system data
        'object_id_legacy',  # Internal system data
        'user_id',  # Internal system data
        'user_uid',  # Internal system data
    }),
    'hub.extrauserdetail': frozenset({
        'date_removal_requested',  # Internal system data
        'date_removed',  # Internal system data
        'id',  # Internal system data
        'last_project_activity',  # Internal system data
        'password_date_changed',  # Private user data
        'private_data',  # Private user data
        'user',  # Unnecessary relational traversal
        'user_id',  # Internal system data
        'validated_password',  # Private user data
    }),
    'kobo_auth.user': frozenset({
        'date_joined',  # Private user data
        'email',  # Private user data (but explicitly allowed in ProjectViewViewSet)
        'first_name',  # Private user data
        'last_name',  # Private user data
        'groups',  # Private user data
        'id',  # Internal system data
        'is_active',  # Private user data
        'is_staff',  # Private user data
        'is_superuser',  # Private user data
        'last_login',  # Private user data
        'password',  # Private user data
        'uid',  # Internal system data
        'user_permissions',  # Private user data
    }),
    'kpi.asset': frozenset({
        'advanced_features',  # Unnecessary relational traversal
        'advanced_features_set',  # Unnecessary relational traversal
        'asset_export_settings',  # Unnecessary relational traversal
        'asset_files',  # Unnecessary relational traversal
        'asset_partial_permissions',  # Unnecessary relational traversal
        'asset_versions',  # Unnecessary relational traversal
        'assetsnapshot',  # Unnecessary relational traversal
        'children',  # Unnecessary relational traversal
        'content',  # Internal system data
        'created_by',  # Unnecessary relational traversal
        'data_collector_group',  # Unnecessary relational traversal
        'data_collector_group_id',  # Internal system data
        'disclaimers',  # Unnecessary relational traversal
        'hooks',  # Unnecessary relational traversal
        'id',  # Internal system data
        'is_excluded_from_projects_list',  # Internal system data
        'known_cols',  # Internal system data
        'map_custom',  # Internal system data
        'map_styles',  # Internal system data
        'nlpusagecounter',  # Unnecessary relational traversal
        'owner_id',  # Internal system data
        'paired_data',  # Unnecessary relational traversal
        'parent_id',  # Internal system data
        'pending_delete',  # Internal system data
        'permissions',  # Unnecessary relational traversal
        'report_custom',  # Internal system data
        'report_styles',  # Internal system data
        'submission_extras',  # Internal system data
        'subsequence_bulk_actions',  # Unnecessary relational traversal
        'tagged_items',  # Unnecessary relational traversal
        'transfers',  # Unnecessary relational traversal
        'trash',  # Unnecessary relational traversal
        'userassetsubscription',  # Unnecessary relational traversal
    }),
    'kpi.importtask': frozenset({
        'id',  # Internal system data
        'messages',  # Internal system data
        'user_id',  # Internal system data
    }),
    'kpi.submissionexporttask': frozenset({
        'id',  # Internal system data
        'last_submission_time',  # Internal system data
        'messages',  # Internal system data
        'result',  # Internal system data
        'user_id',  # Internal system data
    }),
    'kpi.submissionsynchronousexport': frozenset({
        'asset_export_settings',  # Unnecessary relational traversal
        'asset_export_settings_id',  # Internal system data
        'format_type',  # Internal system data
        'id',  # Internal system data
        'last_submission_time',  # Internal system data
        'messages',  # Internal system data
        'result',  # Internal system data
        'user_id',  # Internal system data
    }),
    'kpi.userassetsubscription': frozenset({
        'asset',  # Unnecessary relational traversal
        'asset_id',  # Internal system data
        'user',  # Unnecessary relational traversal
        'user_id',  # Internal system data
    }),
    'languages.language': frozenset({
        'id',  # Internal system data
        'languages',  # Unnecessary relational traversal
        'regions',  # Unnecessary relational traversal
        'transcriptionservicelanguagem2m',  # Unnecessary relational traversal
        'translationservicelanguagem2m',  # Unnecessary relational traversal
    }),
    'languages.transcriptionservice': frozenset({
        'id',  # Internal system data
        'language',  # Unnecessary relational traversal
        'services',  # Unnecessary relational traversal
    }),
    'languages.translationservice': frozenset({
        'id',  # Internal system data
        'language',  # Unnecessary relational traversal
        'services',  # Unnecessary relational traversal
    }),
    'organizations.organization': frozenset({
        'billingandusagesnapshot',  # Unnecessary relational traversal
        'created',  # Internal system data
        'djstripe_customers',  # Unnecessary relational traversal
        'id',  # Internal system data
        'is_active',  # Internal system data
        'mmo_override',  # Internal system data
        'modified',  # Internal system data
        'organization_invites',  # Unnecessary relational traversal
        'organization_type',  # Internal system data
        'organization_users',  # Unnecessary relational traversal
        'owner',  # Unnecessary relational traversal
        'planaddon',  # Unnecessary relational traversal
        'project_views',  # Unnecessary relational traversal
        'users',  # Unnecessary relational traversal
    }),
    'project_views.projectview': frozenset({
        'assignmentprojectviewm2m',  # Unnecessary relational traversal
        'id',  # Internal system data
    }),
    'user_reports.userreports': frozenset({
        'accepted_tos',  # Private user data
        'active_project_count',  # Private user data
        'asset_count',  # Private user data
        'current_period_end',  # Internal system data
        'current_period_start',  # Internal system data
        'date_joined',  # Private user data
        'email',  # Private user data
        'extra_details',  # Unnecessary relational traversal
        'id',  # Internal system data
        'is_active',  # Private user data
        'is_staff',  # Private user data
        'is_superuser',  # Private user data
        'last_login',  # Private user data
        'last_updated',  # Internal system data
        'mfa_is_active',  # Private user data
        'organization',  # Private user data
        'service_usage',  # Private user data
        'social_accounts',  # Private user data
        'sso_is_active',  # Private user data
        'subscriptions',  # Private user data
        'user_uid',  # Internal system data
        'validated_email',  # Private user data
    }),
    'taggit.tag': frozenset({
        'asset',  # Unnecessary relational traversal
        'id',  # Internal system data
        'instance',  # Unnecessary relational traversal
        'slug',  # Internal system data
        'taggit_taggeditem_items',  # Unnecessary relational traversal
        'taguid',  # Unnecessary relational traversal
        'xform',  # Unnecessary relational traversal
    }),
}
