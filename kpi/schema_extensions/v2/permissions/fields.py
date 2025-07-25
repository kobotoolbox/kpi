from rest_framework import serializers
from rest_framework.relations import HyperlinkedIdentityField


class CodenameField(serializers.CharField):
    pass


class ContradictoryField(serializers.SerializerMethodField):
    pass


class ImpliedField(serializers.SerializerMethodField):
    pass


class NameField(serializers.SerializerMethodField):
    pass


class UrlField(HyperlinkedIdentityField):
    pass
