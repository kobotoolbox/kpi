from rest_framework import serializers


class InviteUrlField(serializers.URLField):
    pass


class RecipientSenderUrlField(serializers.URLField):
    pass


class TransferField(serializers.JSONField):
    pass
