## Get a specific size of the user's attachment (Only for images)

Available formats:
- `small`
- `medium`
- `large`

`id` of attachment can be the primary key of the attachment or its `uid`.

Both examples works:
```curl
curl -X GET https://kf.kobotoolbox.org/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/451/attachment/1/small/
```
Or, using the `UID`:
```curl
curl -X GET https://kf.kobotoolbox.org/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/451/attachment/attwYwGxdtQPSqgmHk6wS6E6/medium/
```
