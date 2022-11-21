from allauth.account.models import EmailAddress
from rest_framework import serializers


class EmailAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailAddress
        fields = ("primary", "email", "verified")
        read_only_fields = ("verified",)
