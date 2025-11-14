from rest_framework import serializers


class ExtraDetailsField(serializers.JSONField):
    pass


class OrganizationsField(serializers.JSONField):
    pass


class SubscriptionsField(serializers.JSONField):
    pass
