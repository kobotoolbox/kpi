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
        extr = dict(
            asset.submission_extras.values_list(
                'submission_uuid', 'content'
            )
        )
        submission_stream = stream_with_extras(submission_stream, extr)

    pack, submission_stream = build_formpack(
        asset, submission_stream, True,
    )
    if asset.has_advanced_features:
        pack.extend_survey(asset.analysis_form_json())

    options = {}
    xlsx = 'foo.xlsx'
    pack.export(**options).to_xlsx(xlsx, submission_stream)

def run(asset_uid):
    if asset_uid is None:
        asset = SubmissionExtras.ojects.last().asset
    else:
        asset = Asset.objects.get(uid=asset_uid)
    run_on_asset(asset)
