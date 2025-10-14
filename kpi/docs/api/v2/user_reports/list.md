# List user reports

⚠️ _Only available to superusers_

## Filterable fields by string:

Supports partial filtering
- username
- first_name
- last_name
- email
- organization__name
- organization__role (e.g., admin, member, owner)
- metadata__organization_type
- metadata__* (other string fields, e.g., name, sector, country...)

Exact match only
- subscriptions__id

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

## Filterable fields by boolean:

- is_superuser
- is_staff
- is_active
- validated_email
- validated_password
- mfa_is_active
- sso_is_active
- accepted_tos
- metadata__newsletter_subscription
- subscriptions (empty/not empty list)
- service_usage__balances__*metric*__exceeded (metric: submission, asr_seconds, mt_characters, storage_bytes)
- account_restricted
