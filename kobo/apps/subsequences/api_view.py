import json

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError as APIValidationError
from jsonschema.exceptions import ValidationError as SchemaValidationError
from jsonschema import validate

from kpi.models import Asset
from kobo.apps.subsequences.models import SubmissionExtras


@api_view(['POST', 'PATCH'])
def advanced_submission_post(request, asset_uid=None):
    asset = Asset.objects.get(uid=asset_uid)
    posted_data = request.data
    schema = asset.get_advanced_submission_schema()
    try:
        validate(posted_data, schema)
    except SchemaValidationError as err:
        raise APIValidationError({'error': err})
    s_uuid = posted_data.get('submission')
    try:
        submission = asset.submission_extras.get(uuid=s_uuid)
    except SubmissionExtras.DoesNotExist:
        submission = asset.submission_extras.create(uuid=s_uuid)
    submission.patch_content(request.data)
    submission.save()
    return Response(submission.content)
