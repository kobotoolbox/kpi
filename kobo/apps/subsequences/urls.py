from django.urls import include, path, re_path

from .api_view import advanced_submission_post


KPI_UID_RE=r'a\w{21}'
ASSET_UID_PARAM=f'(?P<asset_uid>{KPI_UID_RE})'

patch_submission_extras = re_path(
    f'^advanced_submission_post/{ASSET_UID_PARAM}$',
    advanced_submission_post,
    name="advanced-submission-post"
)
