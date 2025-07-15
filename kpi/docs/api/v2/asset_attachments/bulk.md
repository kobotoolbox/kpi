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


### !! Due to current DRF-Spectacular limitations with AOS 3.1, DELETE operations do not display request or response bodies in this documentation (as payloads are not typically recommended for DELETE). This means direct testing is unavailable. However, example payloads and responses are provided for reference, and HTTP codes/error messages are accurate.  !!
