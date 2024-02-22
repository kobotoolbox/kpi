from kobo.apps.subsequences.models import SubmissionExtras
from kobo.apps.subsequences.utils import stream_with_extras

from kobo.apps.reports.report_data import build_formpack


HELP_TEXT = '''
Here is a formpack export of the asset with the
most recent translation / transcription:
'''


def run():
    latest_xtra = SubmissionExtras.objects.last()
    asset = latest_xtra.asset
    user = asset.owner
    submission_stream = asset.deployment.get_submissions(
        user=user,
    )
    submission_stream = stream_with_extras(submission_stream, asset)
    _fields_from_all_versions = False #?
    pack, submission_stream = build_formpack(
        asset, submission_stream, _fields_from_all_versions
    )
    my_export = pack.export()

    csv_string = '\n'.join([
        line for line in my_export.to_csv(submissions=submission_stream)
    ])
    print(HELP_TEXT)
    print(csv_string)
