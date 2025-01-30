from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import filters
from rest_framework.exceptions import ParseError
from rest_framework.filters import BaseFilterBackend

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import Instance, XForm
from kobo.apps.openrosa.libs.utils.guardian import get_objects_for_user
from kpi.utils.object_permission import get_database_user


class GuardianObjectPermissionsFilter(BaseFilterBackend):
    """
    Copy from django-rest-framework-guardian `ObjectPermissionsFilter`
    Avoid importing the library (which does not seem to be maintained anymore)
    """

    perm_format = '%(app_label)s.view_%(model_name)s'
    shortcut_kwargs = {
        'accept_global_perms': False,
    }

    ORG_ADMIN_EXEMPT_VIEWS = {
        'XFormListApi': [
            'manifest',
            'list',
        ]
    }

    def filter_queryset(self, request, queryset, view):
        user = request.user
        permission = self.perm_format % {
            'app_label': queryset.model._meta.app_label,
            'model_name': queryset.model._meta.model_name,
        }

        if org_admin_queryset := self._get_objects_for_org_admin(
            request, queryset, view
        ):
            return org_admin_queryset

        return get_objects_for_user(
            user, permission, queryset, **self.shortcut_kwargs
        )

    def _get_objects_for_org_admin(self, request, queryset, view):
        """
        Bypasses the Django Guardian permission mechanism to retrieve all objects
        belonging to the owner of an organization.

        If the current user is an admin of the organization associated with the
        owner of the given object, this method returns all related objects
        without applying Guardian's usual filtering.
        """

        # Only check for specific view and action
        if not (
            view.action in self.ORG_ADMIN_EXEMPT_VIEWS.get(view.__class__.__name__, {})
        ):
            return

        xform_id_string = request.query_params.get('formID', False)
        object_id = request.parser_context['kwargs'].get('pk', False)

        if xform_id_string or object_id:

            xform_filter = (
                {'xforms__id_string': xform_id_string}
                if xform_id_string
                else {'xforms__pk': object_id}
            )

            if (
                owner := User.objects.using(settings.OPENROSA_DB_ALIAS)
                .filter(**xform_filter)
                .first()
            ):
                user = get_database_user(request.user)
                if owner.organization.is_admin_only(user):
                    return queryset.filter(user=owner)


class AnonDjangoObjectPermissionFilter(GuardianObjectPermissionsFilter):
    def filter_queryset(self, request, queryset, view):
        """
        Anonymous user has no object permissions, return queryset as it is.
        """
        if request.user.is_anonymous:
            return queryset

        return super().filter_queryset(request, queryset, view)


class RowLevelObjectPermissionFilter(GuardianObjectPermissionsFilter):
    def filter_queryset(self, request, queryset, view):
        """
        Return queryset as-is if user is anonymous or super user. Otherwise,
        narrow down the queryset to what the user is allowed to see.
        """

        # Queryset cannot be narrowed down for anonymous and superusers because
        # they do not have object level permissions (actually a superuser could
        # have object level permission).
        # Thus, we return queryset immediately even if it is a larger subset and
        # some of its objects are not allowed to accessed by `request.user`.
        # We need to avoid `guardian` filter to allow:
        # - anonymous user to see public data
        # - superuser to take actions on all objects
        # The permissions validation is handled by the permission classes and
        # should deny access to forbidden data.
        if request.user.is_anonymous or request.user.is_superuser:
            return queryset

        return super().filter_queryset(request, queryset, view)


class XFormListObjectPermissionFilter(RowLevelObjectPermissionFilter):
    perm_format = '%(app_label)s.report_%(model_name)s'


class XFormOwnerFilter(filters.BaseFilterBackend):
    owner_prefix = 'user'

    def filter_queryset(self, request, queryset, view):
        owner = request.query_params.get('owner')

        if owner:
            kwargs = {self.owner_prefix + '__username': owner}

            return queryset.filter(**kwargs)

        return queryset


class XFormIdStringFilter(filters.BaseFilterBackend):
    def filter_queryset(self, request, queryset, view):
        id_string = request.query_params.get('id_string')
        if id_string:
            return queryset.filter(id_string=id_string)
        return queryset


class TagFilter(filters.BaseFilterBackend):
    def filter_queryset(self, request, queryset, view):
        # filter by tags if available.
        tags = request.query_params.get('tags', None)

        if tags and isinstance(tags, str):
            tags = tags.split(',')
            return queryset.filter(tags__name__in=tags)

        return queryset


class XFormPermissionFilterMixin:
    @staticmethod
    def _get_xform(request, queryset, view, keyword):
        xform_id = request.query_params.get('xform')
        if not xform_id:
            lookup_field = view.lookup_field
            lookup = view.kwargs.get(lookup_field)
            if not lookup:
                return
            try:
                xform_id = queryset.values_list(
                    '{keyword}_id'.format(keyword=keyword), flat=True
                ).get(pk=lookup)
            except ObjectDoesNotExist:
                raise Http404

        try:
            int(xform_id)
        except ValueError:
            raise ParseError(
                'Invalid value for formid {form_id}.'.format(form_id=xform_id)
            )

        return get_object_or_404(XForm, pk=xform_id)

    def _xform_filter_queryset(self, request, queryset, view, keyword):
        """Use XForm permissions"""

        xform_qs = XForm.objects.all()
        xform = self._get_xform(request, queryset, view, keyword)

        # Anonymous user should not be able to list any data from publicly
        # shared xforms except if they know the direct link.
        # if `xform` is provided,
        # e.g.: `/api/v1/metadata.json?xform=1` for XForm #1
        # or they access a metadata object directly
        # e.g.: `/api/v1/metadata/5.json` for MetaData #5
        # we include all publicly shared xforms
        if xform:
            if xform.shared:
                kwargs = {keyword: xform.pk}
                return queryset.filter(**kwargs)

            xform_qs = xform_qs.filter(pk=xform.pk)

        xforms = super(XFormPermissionFilterMixin, self).filter_queryset(
            request, xform_qs, view
        )

        kwargs = {'{keyword}__in'.format(keyword=keyword): xforms}
        return queryset.filter(**kwargs)


class MetaDataFilter(
    XFormPermissionFilterMixin, GuardianObjectPermissionsFilter
):
    def filter_queryset(self, request, queryset, view):
        queryset = self._xform_filter_queryset(request, queryset, view, 'xform')
        data_type = request.query_params.get('data_type')
        if data_type is not None:
            queryset = queryset.filter(data_type=data_type)
        return queryset


class AttachmentFilter(
    XFormPermissionFilterMixin, GuardianObjectPermissionsFilter
):
    def filter_queryset(self, request, queryset, view):
        queryset = self._xform_filter_queryset(
            request, queryset, view, 'instance__xform'
        )
        instance_id = request.query_params.get('instance')
        if instance_id:
            try:
                int(instance_id)
            except ValueError:
                raise ParseError('Invalid value for instance %s.' % instance_id)
            instance = get_object_or_404(Instance, pk=instance_id)
            queryset = queryset.filter(instance=instance)

        return queryset
