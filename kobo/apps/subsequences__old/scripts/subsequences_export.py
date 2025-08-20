from kpi.models import Asset

from kobo.apps.subsequences.models import SubmissionExtras
from kobo.apps.subsequences.utils import stream_with_extras

from kobo.apps.reports.report_data import build_formpack

def run_on_asset(asset):
    submission_stream = asset.deployment.get_submissions(
        user=asset.owner,
        # fields=fields,
        # submission_ids=submission_ids,
        # query=query,
    )

    if asset.has_advanced_features:
        submission_stream = stream_with_extras(submission_stream, asset)

    pack, submission_stream = build_formpack(
        asset, submission_stream, True,
    )
    if asset.has_advanced_features:
        pack.extend_survey(asset.analysis_form_json())

    options = {
        'group_sep': '/',
        'multiple_select': 'both',
        'lang': None,
        'hierarchy_in_labels': False,
        'force_index': True,
        'tag_cols_for_header': ['hxl'],
        'filter_fields': [],
        'xls_types_as_text': False,
        'include_media_url': True,
    }
    xlsx = 'foo.xlsx'
    pack.export(**options).to_xlsx(xlsx, submission_stream)

def run(asset_uid):
    if asset_uid is None:
        asset = SubmissionExtras.ojects.last().asset
    else:
        asset = Asset.objects.get(uid=asset_uid)
    run_on_asset(asset)
