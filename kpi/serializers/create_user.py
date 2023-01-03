# coding: utf-8
from allauth.account.models import EmailAddress
from django.contrib.auth.models import User
from rest_framework import serializers

from kobo.apps.accounts.validators import (
    USERNAME_REGEX,
    USERNAME_MAX_LENGTH,
    USERNAME_INVALID_MESSAGE,
)


class CreateUserSerializer(serializers.ModelSerializer):
    username = serializers.RegexField(
        regex=USERNAME_REGEX,
        max_length=USERNAME_MAX_LENGTH,
        error_messages={'invalid': USERNAME_INVALID_MESSAGE},
    )
    email = serializers.EmailField()

    class Meta:
        model = User
        fields = (
            'username',
            'password',
            'first_name',
            'last_name',
            'email',
        )
        extra_kwargs = {
            'password': {'write_only': True},
            'email': {'required': True},
        }

    def create(self, validated_data):
        user = User()
        user.set_password(validated_data['password'])
        non_password_fields = list(self.Meta.fields)
        try:
            non_password_fields.remove('password')
        except ValueError:
            pass
        for field in non_password_fields:
            try:
                setattr(user, field, validated_data[field])
            except KeyError:
                pass
        user.save()
        EmailAddress.objects.create(
            user_id=user.id,
            email=user.email,
            verified=True,
        )
        return user
