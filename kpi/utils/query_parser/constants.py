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
# be maintained in `kpi.contants.ALLOWED_LOOKUP_FIELDS`. The idea is to block
# sensitive data from being used with search filters
# Granularity is at the explicit model level.
# ```
# ALLOWED_LOOKUP_FIELDS = {
#     'app_label.model_name': {'field1', 'field2', ...},
#     ...
# }
# ```

ALLOWED_LOOKUP_FIELDS = {
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
        'username',
        'first_name',
        'last_name',
        'extra_details',   # To allow extra_details__data
    }),
    'kpi.asset': frozenset({
        '_deployment_status',
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
DENIED_LOOKUP_FIELDS = {
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
    'kobo_auth.user': frozenset({
        'email',
        'is_superuser',
        'is_staff',
        'is_active',
        'password',
        'date_joined',
        'last_login',
        'uid',  # We don't want people to try to guess the uid
    }),
    'hub.extrauserdetail': frozenset({
        'private_data',  # Private user data
    }),
}
