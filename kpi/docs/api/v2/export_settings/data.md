## Synchronously export data

To retrieve data synchronously in CSV and XLSX format according to a
particular instance of export settings, access the URLs given by
`data_url_csv` and `data_url_xlsx`:
```shell
curl -X GET https://kf.kobotoolbox.org/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/export-settings/1/data.csv
```

```shell
curl -X GET https://kf.kobotoolbox.org/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/export-settings/1/data.xlsx
```

Processing time of synchronous exports is substantially limited compared to
asynchronous exports, which are available at `/api/v2/assets/{asset_uid}/exports/`.
