# -*- coding: utf-8 -*-
from __future__ import absolute_import

from django.contrib.auth.models import Permission
from django.utils.translation import ugettext as _
from rest_framework import serializers
from rest_framework.fields import empty
from rest_framework.relations import HyperlinkedIdentityField
from rest_framework.reverse import reverse

from kpi.models.asset import Asset
from kpi.models.collection import Collection


class PermissionSerializer(serializers.ModelSerializer):

    url = HyperlinkedIdentityField(
        lookup_field='codename', view_name='permission-detail')
    implied = serializers.SerializerMethodField()
    contradictory = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()

    class Meta:
        model = Permission
        fields = (
            'url',
            'codename',
            'implied',
            'contradictory',
            'name',
            'description'
        )

        read_only_fields = ('url', 'codename', 'implied', 'contradictory',
                            'name', 'description')

    def __init__(self, instance=None, data=empty, **kwargs):
        # Init dicts for later purpose (see below)
        self.__implied_permissions = {}
        self.__contradictory_permissions = {}
        super(PermissionSerializer, self).__init__(instance=instance, data=data,
                                                   **kwargs)

        self.__asset_key = self.__get_key(Asset._meta.app_label,
                                          Asset._meta.model_name)
        self.__collection_key = self.__get_key(Collection._meta.app_label,
                                               Collection._meta.model_name)
        # Prepare dicts for later purpose
        # (i.e. `get_implied` & `get_contradictory`)
        self.__init_implied_permissions()
        self.__init_contradictory_permissions()

    def get_contradictory(self, permission):
        permission_key = self.__get_key(permission.content_type.app_label,
                                        permission.content_type.model)

        contradictory_permissions = self.__contradictory_permissions.get(permission_key)

        if contradictory_permissions:
            return contradictory_permissions.get(permission.codename, [])
        return []

    def get_description(self, permission):
        return _(permission.name)

    def get_implied(self, permission):
        permission_key = self.__get_key(permission.content_type.app_label,
                                        permission.content_type.model)

        implied_permissions = self.__implied_permissions.get(permission_key)

        if implied_permissions:
            return implied_permissions.get(permission.codename, [])
        return []

    def get_name(self, permission):
        # @TODO add name
        return ""

    @staticmethod
    def __get_key(app_label, model_name):
        """
        Creates a key to match against permission app_label and model_name.

        :param app_label: str
        :param model_name: str
        :return:
        """
        return '{}_{}'.format(
            app_label,
            model_name
        )

    def __get_hyperlinked_permissions(self, mapped_perms_dict):
        """
        Replaces permissions' codenames in value of key,value dict `mapped_perms_dict`
        but their API detail url.
        Useful for RESTful API representation.

        For example:
        ```
        {
            "change_submissions": ["view_submissions", "view_asset"]
        }
        ```

        ```
        {
            "change_submissions": [
                "https://kpi/api/v2/permissions/view_asset/",
                "https://kpi/api/v2/permissions/view_submissions/"
            ]
        }
        ```

        :param mapped_perms_dict: dict
        :return: dict
        """
        hyperlinked_permissions = {}

        for codename, codenames in mapped_perms_dict.items():
            hyperlinked_permissions[codename] = [
                reverse(viewname='permission-detail',
                        kwargs={'codename': codename_},
                        request=self.context.get('request', None))
                for codename_ in codenames
            ]

        return hyperlinked_permissions

    def __init_contradictory_permissions(self):
        """
        Prepares `self.__contradictory_permissions` for serializing
        It will contains all contradictory permissions for `Asset` and `Collection`
        classes.

        :return: dict
        """
        self.__contradictory_permissions = {
            self.__asset_key: self.__get_hyperlinked_permissions(
                Asset.CONTRADICTORY_PERMISSIONS),
            self.__collection_key: self.__get_hyperlinked_permissions(
                Collection.CONTRADICTORY_PERMISSIONS)
        }

    def __init_implied_permissions(self):
        """
        Prepares `self.__implied_permissions` for serializing
        It will contains all implied permissions for `Asset` and `Collection`
        classes.

        :return: dict
        """

        def get_all_implied_permissions(obj):
            """
            Object.`IMPLIED_PERMISSIONS` only returns direct mapped permissions.
            This returns all parent implied permissions.

            e.g: In `Asset.IMPLIED_PERMISSIONS`, `change_submissions` is only mapped
            to `view_submissions`. But `view_submissions` implies `view_asset`.

            For this particular case return dict will be:
            ```
            {
                "change_submissions": ["view_asset", "view_submission"]
            }
            ```
            instead of
            ```
            {
                "change_submissions": ["view_submissions"]
            }
            ```

            :param obj: Class Object.
            :return: dict
            """
            obj_implied_permissions = {}
            for perm, implied_perms in obj.IMPLIED_PERMISSIONS.items():
                all_implied_perms = set()
                for implied_perm in implied_perms:
                    all_implied_perms.add(implied_perm)
                    for other_implied_perm in obj.get_implied_perms(implied_perm):
                        all_implied_perms.add(other_implied_perm)
                obj_implied_permissions[perm] = list(all_implied_perms)

            return obj_implied_permissions

        self.__implied_permissions = {
            self.__asset_key: self.__get_hyperlinked_permissions(
                get_all_implied_permissions(Asset)),
            self.__collection_key: self.__get_hyperlinked_permissions(
                get_all_implied_permissions(Collection))
        }


