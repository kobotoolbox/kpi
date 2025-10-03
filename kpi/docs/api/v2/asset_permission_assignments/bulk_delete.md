## Remove all permission assignments

⚠️ **Warning**
This endpoint currently supports deleting **only the user whose username is provided as a parameter**.
Deletion of other accounts is not yet supported.

**Payload**
```json
{
   "username": "bob"
}
```

_Due to limitations with DRF-Spectacular current version, `DELETE` actions do not support showing a request body OR a response body. This is due to the 'vague' nature of the action which generally does *not* recommend the use of a payload. To still document this endpoint, example for the payload and response will be included but it will not be possible to test this endpoint. The HTTP code and the errors example are, for their part, factual and can be considered when working with the endpoint._
