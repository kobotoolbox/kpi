# coding: utf-8
from rest_framework import serializers


class AuthorizedApplicationUserSerializer(serializers.BaseSerializer):

    username = serializers.CharField()
    password = serializers.CharField(style={'input_type': 'password'})
    token = serializers.CharField(read_only=True)

    def to_internal_value(self, data):
        field_names = ('username', 'password')
        validation_errors = {}
        validated_data = {}
        for field_name in field_names:
            value = data.get(field_name)
            if not value:
                validation_errors[field_name] = 'This field is required.'
            else:
                validated_data[field_name] = value
        if len(validation_errors):
            raise serializers.ValidationError(validation_errors)
        return validated_data
