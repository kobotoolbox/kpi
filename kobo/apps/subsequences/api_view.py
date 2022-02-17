import json

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError as APIValidationError
from jsonschema.exceptions import ValidationError as SchemaValidationError
from jsonschema import validate

from kpi.models import Asset
from kobo.apps.subsequences.models import SubmissionExtras


@api_view(['GET', 'POST', 'PATCH'])
def advanced_submission_post(request, asset_uid=None):
    asset = Asset.objects.get(uid=asset_uid)
    if request.method == 'GET':
        if 'submission' in request.data:
            s_uuid = request.data.get('submission')
        else:
            s_uuid = request.query_params.get('submission')
        return get_submission_processing(asset, s_uuid)
    posted_data = request.data
    schema = asset.get_advanced_submission_schema()
    try:
        validate(posted_data, schema)
    except SchemaValidationError as err:
        raise APIValidationError({'error': err})
    submission = asset.update_submission_extra(posted_data)
    return Response(submission.content)


def get_submission_processing(asset, s_uuid):
    try:
        submission = asset.submission_extras.get(uuid=s_uuid)
        return Response(submission.content)
    except SubmissionExtras.DoesNotExist:
        # submission might exist but no SubmissionExtras object has been created
        return Response({'info': f'nothing found for submission: {s_uuid}'})
