from rest_framework import serializers


class ExtraDetailField(serializers.DateTimeField):
    pass


class DateJoinedField(serializers.DateTimeField):
    pass


class GravatarField(serializers.URLField):
    pass


class ProjectUrlField(serializers.URLField):
    pass


class OrganizationField(serializers.URLField):
    pass


class ServerTimeField(serializers.DateTimeField):
    pass
