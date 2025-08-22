from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import BalancesField, NlpUsageField, SubmissionCountField

ServiceUsageResponse = inline_serializer_class(
    name='ServiceUsageResponse',
    fields={
        'total_nlp_usage': NlpUsageField(),
        'total_storage_bytes': serializers.IntegerField(),
        'total_submission_count': SubmissionCountField(),
        'balances': BalancesField(),
        'current_period_start': serializers.DateTimeField(),
        'current_period_end': serializers.DateTimeField(),
        'last_updated': serializers.DateTimeField(),
    },
)
