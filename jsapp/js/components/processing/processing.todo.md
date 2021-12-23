1. create asset 
2. go to asset endpoint
3. look at `advanced_submission_schema`

get advanced_submission_post url from `asset.advanced_submission_schema.url`

advanced_submission_post - for setting

Enabling processing features in latest asset:

1. Create a form with a NAMED audio or video question.
2. Go to `kobo-install`.
3. Enter the container: `./run.py -cf exec kpi bash`.
4. Run `python manage.py runscript activate_advanced_features_for_newest_asset`.


TODO:
- make sure singleProcessingStore waits for initialization for the asset to be loaded? whenLoaded?
- set calls should use the existing schema