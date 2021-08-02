# coding: utf-8
from django.contrib.auth.models import Permission
from django.utils.translation import ugettext as _
from rest_framework import serializers
from rest_framework.fields import empty
from rest_framework.relations import HyperlinkedIdentityField
from rest_framework.reverse import reverse

from kpi.models.asset import Asset


class PermissionSerializer(serializers.ModelSerializer):

    url = HyperlinkedIdentityField(
        lookup_field='codename', view_name='permission-detail')
    implied = serializers.SerializerMethodField()
    contradictory = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()

    class Meta:
        model = Permission
        fields = (
            'url',
            'codename',
            'implied',
            'contradictory',
            'name',
        )

        read_only_fields = ('url', 'codename', 'implied', 'contradictory',
                            'name')

    def __init__(self, instance=None, data=empty, **kwargs):
        # Init dicts for later purpose (see below)
        self.__implied_permissions = {}
        self.__contradictory_permissions = {}
        super().__init__(instance=instance, data=data, **kwargs)

        self.__asset_key = self.__get_key(Asset._meta.app_label,
                                          Asset._meta.model_name)
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

    def get_name(self, permission):
        return _(permission.name)

    def get_implied(self, permission):
        permission_key = self.__get_key(permission.content_type.app_label,
                                        permission.content_type.model)

        implied_permissions = self.__implied_permissions.get(permission_key)

        if implied_permissions:
            return implied_permissions.get(permission.codename, [])
        return []

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
        Replaces permissions' codenames in the values of
        `mapped_perms_dict` with API detail URLs.
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
        It will contain all contradictory permissions for the `Asset` class.

        :return: dict
        """
        self.__contradictory_permissions = {
            self.__asset_key: self.__get_hyperlinked_permissions(
                Asset.CONTRADICTORY_PERMISSIONS),
        }

    def __init_implied_permissions(self):
        """
        Prepares `self.__implied_permissions` for serializing
        It will contain all implied permissions for the `Asset` class.

        :return: dict
        """

        self.__implied_permissions = {
            self.__asset_key: self.__get_hyperlinked_permissions(
                Asset.get_all_implied_perms()),
        }
