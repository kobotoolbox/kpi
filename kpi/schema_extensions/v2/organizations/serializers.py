from rest_framework import serializers

from kobo.apps.organizations.models import OrganizationType
from kpi.utils.schema_extensions.serializers import inline_serializer_class
from ..service_usage.fields import BalancesField
from .fields import TotalNlpUsageField, TotalSubmissionCountField


class NlpUsageSerializer(serializers.Serializer):
    total_nlp_asr_seconds = serializers.IntegerField()
    total_nlp_mt_characters = serializers.IntegerField()


OrganizationServiceUsageResponse = inline_serializer_class(
    name='OrganizationServiceUsageResponse',
    fields={
        'total_nlp_usage': TotalNlpUsageField(),
        'total_storage_bytes': serializers.IntegerField(),
        'total_submission_count': TotalSubmissionCountField(),
        'balances': BalancesField(),
        'current_period_start': serializers.DateTimeField(),
        'current_period_end': serializers.DateTimeField(),
        'last_updated': serializers.DateTimeField(),
    },
)

OrganizationPatchPayload = inline_serializer_class(
    name='OrganizationPatchPayload',
    fields={
        'name': serializers.CharField(max_length=200),
        'website': serializers.CharField(max_length=255),
        'organization_type': serializers.ChoiceField(
            choices=OrganizationType.choices,
        ),
    },
)
