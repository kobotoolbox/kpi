<span class='label label-warning'>⚠️ Deprecated</span>
## Track Service Usage

Tracks the total usage of different services for the logged-in user
Tracks the submissions and NLP seconds/characters for the current month/year/all time
Tracks the current total storage used
Note: this endpoint is not currently used by the frontend to display usage information
See /api/v2/organizations/{organization_id}/service_usage/ for the endpoint we use on the Usage page

> Example
>
>       curl -X GET https://[kpi]/api/v2/service_usage/
>       {
>           "total_nlp_usage": {
>               "asr_seconds_current_period": {integer},
>               "asr_seconds_all_time": {integer},
>               "mt_characters_current_period": {integer},
>               "mt_characters_all_time": {integer},
>           },
>           "total_storage_bytes": {integer},
>           "total_submission_count": {
>               "current_period": {integer},
>               "all_time": {integer},
>           },
>           "balances": {
>               "asr_seconds": {
>                   "effective_limit": {integer},
>                   "balance_value": {integer},
>                   "balance_percent": {integer},
>                   "exceeded": {boolean},
>               } | {None},
>               "mt_characters": {
>                   "effective_limit": {integer},
>                   "balance_value": {integer},
>                   "balance_percent": {integer},
>                   "exceeded": {boolean},
>               } | {None},
>               "storage_bytes": {
>                   "effective_limit": {integer},
>                   "balance_value": {integer},
>                   "balance_percent": {integer},
>                   "exceeded": {boolean},
>               } | {None},
>               "submission": {
>                   "effective_limit": {integer},
>                   "balance_value": {integer},
>                   "balance_percent": {integer},
>                   "exceeded": {boolean},
>               } | {None},
>           },
>           "current_period_start": {string (date), ISO format},
>           "current_period_end": {string (date), ISO format}|{None},
>           "last_updated": {string (date), ISO format},
>       }
