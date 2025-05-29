## Get an asset's attachment using the ID

* `parent_lookup_data` can be the primary key of the submission or its `uuid`.
Please note that using the `uuid` may match **several** submissions, only
the first match will be returned.

* `id` of attachment can be the primary key of the attachment or its `uid`.

Both examples works:
```curl
curl -X GET https://kf.kobotoolbox.org/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/451/attachment/1/
```
Or, using the `UID`:
```curl
curl -X GET https://kf.kobotoolbox.org/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/451/attachment/attwYwGxdtQPSqgmHk6wS6E6/
```

### Get an MP3 file from an audio or video file
Convert audio and video files. Only conversions to MP3 is supported for this feature

```curl
curl -X GET https://kf.kobotoolbox.org/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/451/attachment/1/?format=mp3
```
