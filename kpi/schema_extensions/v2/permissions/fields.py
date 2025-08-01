from rest_framework import serializers
from rest_framework.relations import HyperlinkedIdentityField


class CodenameField(serializers.CharField):
    pass


class ContradictoryField(serializers.ListField):
    pass


class ImpliedField(serializers.ListField):
    pass


class NameField(serializers.CharField):
    pass


class UrlField(HyperlinkedIdentityField):
    pass
