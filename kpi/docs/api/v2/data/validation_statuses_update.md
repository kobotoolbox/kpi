## Bulk update submissions status

* Where: "submissions_ids" (required) is a list of submission root id on the data
to delete
* Where: "validation_status.uid" (required)  is a string and can be one of these values:
  * `validation_status_approved`
  * `validation_status_not_approved`
  * `validation_status_on_hold`

Will return the number of submission updated as such:
> **Response**
>
>        {
>           "detail": "{number_of_submissions} submissions have been updated"
>        }
