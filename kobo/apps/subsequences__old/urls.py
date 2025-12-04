from django.urls import include, path, re_path

from .api_view import AdvancedSubmissionView


KPI_UID_RE=r'a\w{21}'
ASSET_UID_PARAM=f'(?P<asset_uid>{KPI_UID_RE})'

urlpatterns = [
    re_path(
        f'^advanced_submission_post/{ASSET_UID_PARAM}$',
        AdvancedSubmissionView.as_view(),
        name="advanced-submission-post"
    )
]
