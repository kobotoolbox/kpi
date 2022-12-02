from allauth.account.models import EmailAddress
from rest_framework import serializers, validators


class EmailAddressSerializer(serializers.ModelSerializer):
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = EmailAddress
        fields = ('user', 'primary', 'email', 'verified')
        read_only_fields = ('verified', 'primary')
        validators = [
            validators.UniqueTogetherValidator(
                queryset=EmailAddress.objects.all(), fields=['user', 'email']
            ),
        ]

    def create(self, validated_data):
        # First delete any non-primary, unconfirmed emails
        validated_data['user'].emailaddress_set.filter(
            primary=False, verified=False
        ).delete()
        return super().create(validated_data)
