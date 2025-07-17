from rest_framework import serializers
from rest_framework.relations import HyperlinkedIdentityField


class MetadataField(serializers.JSONField):
    pass
