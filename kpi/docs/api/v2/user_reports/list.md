# List user reports

⚠️ _Only available to superusers_

## Filterable fields by string:

Supports partial filtering
- username
- first_name
- last_name
- email
- user_uid
- organization__name
- organization__role (e.g., admin, member, owner)
- organization__website
- extra_details__data__organization_type
- `extra_details__data__<field>` (other string fields, e.g., name, sector, country...)

## Filterable fields by int:

Supports exact matching and range operators (e.g., gte, lte)

**Total NLP Usage**
- service_usage__total_nlp_usage__asr_seconds_all_time
- service_usage__total_nlp_usage__mt_characters_all_time
- service_usage__total_nlp_usage__asr_seconds_current_period
- service_usage__total_nlp_usage__mt_characters_current_period

**Total Storage/Submissions**
- service_usage__total_storage_bytes
- service_usage__total_submission_count__all_time
- service_usage__total_submission_count__current_period

**Service Usage Balances**

Prefix: `service_usage__balances__<metric>__<value>`

Metric:
- submission
- asr_seconds
- mt_characters
- storage_bytes

Value:
- balance_value
- balance_percent
- effective_limit

Ex: `service_usage__balances__submission__balance_value`

**Asset Count**
- asset_count
- deployed_asset_count

## Filterable fields by date:
Supports exact matching and range operators (e.g., gte, lte)

- date_joined
- last_login
- extra_details__date_removal_requested
- extra_details__date_removed
- extra_details_password_date_changed

## Filterable fields by boolean:

- is_superuser
- is_staff
- is_active
- validated_email
- extra_details__validated_password
- mfa_is_active
- sso_is_active
- accepted_tos
- extra_details__data__newsletter_subscription
- service_usage__balances__*metric*__exceeded (metric: submission, asr_seconds, mt_characters, storage_bytes)
- account_restricted

## Filterable fields by list:

Subscription filtering:

Has subscriptions

`?q=subscriptions__0__id__isnull:False`

No subscriptions

`?q=subscriptions__0__id__isnull:True`

Subscription id

`?q=subscriptions[]__id:sub_1QwPItAR39rDI89stzLJ040p`

Active subscriptions

`?q=subscriptions[]__status:active`
