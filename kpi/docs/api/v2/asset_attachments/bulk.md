## Delete all attachments from a list of submissions

```curl
  curl -X DELETE https://kf.kobotoolbox.org/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/attachments/bulk/
```

> **Payload**
>
>        {
>           "submission_root_uuids": [
>               "3ed2e8de-b493-4367-a78d-3463687239dc",
>               "ef18fe33-c71d-4638-84d6-dafcbd69c327"
>           ]
>        }

* Where: "submission_root_uuids" (required) is a list of submission root uuids on the asset
to delete


> **Response**
>
>        {
>           "message": "{number_of_attachment} attachments deleted"
>        }

* Where: "number_of_attachment" is the number of items that was deleted


### !! Due to limitations with DRF-Spectacular current version not fully supporting AOS 3.1, DELETE actions do not support showing a request body OR a response body. This is due to the 'vague' nature of the action which generally does *not* recommend the use of a payload. To still document this endpoint, example for the payload and response will be included but it will not be possible to test this endpoint. The HTTP code and the errors example are, for their part, factual and can be considered when working with the endpoint. !!
