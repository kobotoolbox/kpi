# coding: utf-8
from django.db import transaction
from rest_framework import serializers

from kobo.apps.accounts.validators import (
    USERNAME_REGEX,
    USERNAME_MAX_LENGTH,
    USERNAME_INVALID_MESSAGE,
)
from kobo.apps.kobo_auth.shortcuts import User


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

    @transaction.atomic
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

        # This special endpoint bypasses the typical email validation process
        user.emailaddress_set.create(
            email=user.email,
            verified=True,
            primary=True,
        )

        self._update_extra_details(user)

        return user

    def _update_extra_details(self, user):
        # Combine `first_name` and `last_name` into the single `name` that's
        # currently used
        user.extra_details.data['name'] = ' '.join(
            (user.first_name, user.last_name)
        ).strip()

        # Store the organization if provided
        try:
            organization = self.initial_data['organization']
        except KeyError:
            pass
        else:
            user.extra_details.data['organization'] = organization

        user.extra_details.save()
