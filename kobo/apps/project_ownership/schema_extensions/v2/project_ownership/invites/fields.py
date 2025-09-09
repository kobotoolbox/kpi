from rest_framework import serializers


class InviteAssetField(serializers.ListField):
    pass


class InviteUrlField(serializers.URLField):
    pass


class RecipientSenderUrlField(serializers.URLField):
    pass


class StatusEnumField(serializers.CharField):
    pass


class TransferField(serializers.JSONField):
    pass
