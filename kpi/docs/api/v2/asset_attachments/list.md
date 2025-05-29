## Get an asset's attachment using xpath

* `parent_lookup_data` can be the primary key of the submission or its `uuid`.
Please note that using the `uuid` may match **several** submissions, only
the first match will be returned.

Use the `xpath` property to retrieve an attachment.

```curl
curl -X GET https://kf.kobotoolbox.org/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/451/attachment/?xpath=Upload_a_file
```

## Get an MP3 file from an audio or video file
Convert audio and video files. Only conversions to MP3 is supported for this feature

```curl
curl -X GET https://kf.kobotoolbox.org/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/data/451/attachment/?xpath=Upload_a_file&format=mp3
```
