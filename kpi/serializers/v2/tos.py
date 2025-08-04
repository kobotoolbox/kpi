from rest_framework import serializers
from rest_framework.relations import HyperlinkedIdentityField

from hub.models import SitewideMessage


class TermsOfServiceSerializer(serializers.ModelSerializer):

    url = HyperlinkedIdentityField(
        lookup_field='slug',
        view_name='terms-of-service-detail'
    )

    class Meta:
        model = SitewideMessage
        fields = (
            'url',
            'slug',
            'body',
        )

        read_only_fields = (
            'url',
            'slug',
            'body',
        )
