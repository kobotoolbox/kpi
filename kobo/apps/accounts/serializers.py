from allauth.account.models import EmailAddress
from rest_framework import serializers


class EmailAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailAddress
        fields = ('primary', 'email', 'verified')
        read_only_fields = ('verified', 'primary')

    def create(self, validated_data):
        # First delete any non-primary, unconfirmed emails
        request = self.context['request']
        request.user.emailaddress_set.filter(
            primary=False, verified=False
        ).delete()
        return EmailAddress.objects.add_email(
            request,
            request.user,
            validated_data['email'],
            confirm=True,
        )
