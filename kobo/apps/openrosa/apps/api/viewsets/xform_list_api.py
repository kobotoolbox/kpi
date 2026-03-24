from datetime import datetime
from zoneinfo import ZoneInfo

from django.apps import apps
from django.conf import settings
from django.core.cache import cache
from django.db.models import F, Q
from django.db.models.expressions import RawSQL
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.urls import Resolver404, resolve
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from kobo.apps.data_collectors.authentication import DataCollectorTokenAuthentication
from kobo.apps.data_collectors.models import DataCollector
from kobo.apps.form_disclaimer.models import FormDisclaimer
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.api.tools import get_media_file_response
from kobo.apps.openrosa.apps.logger.models.xform import XForm
from kobo.apps.openrosa.apps.main.models.meta_data import MetaData
from kobo.apps.openrosa.libs import filters
from kobo.apps.openrosa.libs.renderers.renderers import (
    MediaFileContentNegotiation,
    XFormListRenderer,
    XFormManifestRenderer,
)
from kobo.apps.openrosa.libs.serializers.xform_serializer import (
    XFormListSerializer,
    XFormManifestSerializer,
)
from kobo.apps.openrosa.schema_extensions.v2.manifest.serializers import (
    OpenRosaFormManifestResponse,
)
from kpi.authentication import DigestAuthentication
from kpi.constants import PERM_MANAGE_ASSET
from kpi.models.object_permission import ObjectPermission
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import open_api_200_ok_response
from ..utils.rest_framework.viewsets import OpenRosaReadOnlyModelViewSet


class XFormListApi(OpenRosaReadOnlyModelViewSet):

    content_negotiation_class = MediaFileContentNegotiation
    filter_backends = (filters.XFormListObjectPermissionFilter,)
    queryset = XForm.objects.filter(downloadable=True)
    permission_classes = (permissions.AllowAny,)
    renderer_classes = (XFormListRenderer,)
    serializer_class = XFormListSerializer
    template_name = 'api/xformsList.xml'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Respect DEFAULT_AUTHENTICATION_CLASSES, but also ensure that the
        # previously hard-coded authentication classes are included first
        authentication_classes = [DigestAuthentication]
        self.authentication_classes = authentication_classes + [
            auth_class
            for auth_class in self.authentication_classes
            if auth_class not in authentication_classes
        ]

    def get_queryset(self):
        # Only load the fields we need in the context we need
        queryset = super().get_queryset()

        if not (self.action.startswith('form_list') or self.action == 'list'):
            queryset = queryset.only(
                'user__username', 'kpi_asset_uid', 'id_string', 'pk'
            )
        else:
            queryset = (
                queryset.select_related('user')
                .annotate(
                    version_extracted=RawSQL("(json::jsonb)->>'version'", []),
                    name_extracted=RawSQL("(json::jsonb)->>'name'", []),
                )
                .defer('json')
            )

        # remove order_by since order by is handled by the client
        return queryset.order_by()

    def get_openrosa_headers(self):
        dt = datetime.now(tz=ZoneInfo('UTC')).strftime('%a, %d %b %Y %H:%M:%S %Z')

        return {
            'Date': dt,
            'X-OpenRosa-Version': '1.0',
            'X-OpenRosa-Accept-Content-Length': settings.OPENROSA_DEFAULT_CONTENT_LENGTH,
            'Content-Type': 'text/xml; charset=utf-8',
        }

    def get_response_for_head_request(self):
        # Copied from
        # https://github.com/kobotoolbox/kpi/commit/cabcaaa664159320ba281fd588423423a17f5b82
        # See further discussion there
        return Response(
            headers=self.get_openrosa_headers(), status=status.HTTP_204_NO_CONTENT
        )

    def get_renderers(self):
        if self.action and self.action.startswith('manifest'):
            return [XFormManifestRenderer()]

        return super().get_renderers()

    def filter_queryset(self, queryset):
        username = self.kwargs.get('username')
        token = self.kwargs.get('token')
        if token:
            try:
                collector = DataCollector.objects.get(token=token)
                collector_group = collector.group
                if collector_group:
                    assets = list(collector_group.assets.values_list('uid', flat=True))
                    queryset = queryset.filter(kpi_asset_uid__in=assets)
                else:
                    return XForm.objects.none()
            except DataCollector.DoesNotExist:
                return XForm.objects.none()
        elif username is None:
            # If no username is specified, the request must be authenticated
            if self.request.user.is_anonymous:
                # raises a permission denied exception, forces authentication
                self.permission_denied(self.request)
            else:
                # Return all the forms the currently-logged-in user can access,
                # including those shared by other users
                queryset = super().filter_queryset(queryset)
        else:
            # Only return projects that allow anonymous submissions and are managed
            # by the user matching the given username.
            try:
                openrosa_user = User.objects.get(username=username)
            except User.DoesNotExist:
                # Intentionally returns an empty list instead of a 404 to indicate
                # no results found.
                return XForm.objects.none()

            # No need to filter by asset_type or archive status (and trigger additional
            # joins), since OpenRosa only handles surveys and already excludes archived
            # forms.
            asset_uids = list(
                ObjectPermission.objects.values_list('asset__uid', flat=True).filter(
                    permission__codename=PERM_MANAGE_ASSET,
                    deny=False,
                    user_id=openrosa_user.pk,
                )
            )

            queryset = queryset.filter(
                Q(user__username=username.lower()) | Q(kpi_asset_uid__in=asset_uids),
                require_auth=False,
            )

        try:
            # https://docs.getodk.org/openrosa-form-list/#form-list-api says:
            #   `formID`: If specified, the server MUST return information for
            #   only this formID.
            id_string_filter = self.request.GET['formID']
        except KeyError:
            pass
        else:
            queryset = queryset.filter(id_string=id_string_filter)

        # Submissions for forms owned by inactive users are already blocked by
        # #5321; those forms should be excluded from `formList` as well
        queryset = queryset.exclude(user__is_active=False)

        return queryset

    @extend_schema(
        description=read_md('openrosa', 'formlist/anonymous.md'),
        responses=open_api_200_ok_response(
            XFormListSerializer,
            media_type='application/xml',
            require_auth=False,
            validate_payload=False,
            raise_access_forbidden=False,
            raise_not_found=False,
        ),
        tags=['OpenRosa Form List'],
        operation_id='form_list_anonymous',
    )
    @action(
        detail=False,
        methods=['get'],
    )
    def form_list_anonymous(self, request, *args, **kwargs):
        """
        Publish the OpenRosa formList via a custom action instead of relying on the
        ViewSet's default `list()` route.

        Why? drf-spectacular treats `list` actions as arrays (`many=True`) and
        auto-wraps the response in the OpenAPI schema. For XML, Swagger UI struggles
        to generate an example for top-level arrays, especially when we need a named
        root.
        Exposing a custom action lets us control the response schema (e.g.
        XML root as `<xforms>`) so Swagger UI can render the XML example correctly.



        ViewSet for managing enketo form list

        Available actions:
        - form_list (anonymous)         → GET /api/v2/{username}/formList/

        Documentation:
        - docs/api/v2/form_list/anonymous.md
        """
        return self.list(request, *args, **kwargs)

    @extend_schema(
        description=read_md('openrosa', 'formlist/authenticated.md'),
        responses=open_api_200_ok_response(
            XFormListSerializer,
            media_type='application/xml',
            require_auth=False,
            validate_payload=False,
            raise_access_forbidden=False,
            raise_not_found=False,
        ),
        tags=['OpenRosa Form List'],
        operation_id='form_list_authenticated',
    )
    @action(detail=False, methods=['get'])
    def form_list_authenticated(self, request, *args, **kwargs):
        """
        Publish the OpenRosa formList via a custom action instead of relying on the
        ViewSet's default `list()` route.

        Why? drf-spectacular treats `list` actions as arrays (`many=True`) and
        auto-wraps the response in the OpenAPI schema. For XML, Swagger UI struggles
        to generate an example for top-level arrays, especially when we need a named
        root.
        Exposing a custom action lets us control the response schema (e.g.
        XML root as `<xforms>`) so Swagger UI can render the XML example correctly.



        ViewSet for managing enketo form list

        Available actions:
        - form_list (authenticated)     → GET /api/v2/formList/

        Documentation:
        - docs/api/v2/form_list/authenticated.md
        """
        return self.list(request, *args, **kwargs)

    @extend_schema(
        description=read_md('openrosa', 'formlist/data_collector.md'),
        responses=open_api_200_ok_response(
            XFormListSerializer,
            media_type='application/xml',
            require_auth=False,
            validate_payload=False,
            raise_access_forbidden=False,
            raise_not_found=False,
        ),
        tags=['OpenRosa Form List'],
        operation_id='form_list_data_collector',
    )
    @action(
        detail=False,
        methods=['get'],
        authentication_classes=[DataCollectorTokenAuthentication],
    )
    def form_list_dc(self, request, *args, **kwargs):
        """
        See form_list_anonymous for why this is a separated method

        ViewSet for managing enketo form list

        Available actions:
        - form_list (data collector)         → GET /api/v2/collector/{token}/formList/

        Documentation:
        - docs/api/v2/form_list/data_collector.md
        """
        return self.list(request, *args, **kwargs)

    @extend_schema(tags=['OpenRosa Form List'], exclude=True)
    def list(self, request, *args, **kwargs):
        """
        Internal implementation used by `form_list()`.

        Hidden from the schema (`exclude=True`) to avoid documenting the same endpoint
        twice and to ensure the custom action is the single source of truth with
        the XML-friendly schema (named `<xforms>` root and `<xform>` items).
        """
        object_list = self.filter_queryset(self.get_queryset())

        if request.method == 'HEAD':
            return self.get_response_for_head_request()

        asset_uids = list(object_list.values_list('kpi_asset_uid', flat=True))
        assets_by_uid, disclaimers_by_asset_pk = self._fetch_assets_and_disclaimers(
            asset_uids
        )

        serializer = self.get_serializer(
            self._enrich_xforms(object_list, assets_by_uid, disclaimers_by_asset_pk),
            many=True,
            require_auth=not bool(kwargs.get('username')),
        )
        return Response(serializer.data, headers=self.get_openrosa_headers())

    @extend_schema(tags=['OpenRosa Form List'], exclude=True)
    def retrieve(self, request, *args, **kwargs):
        xform = self.get_object()

        return Response(
            xform.xml_with_disclaimer, headers=self.get_openrosa_headers()
        )

    @extend_schema(
        description=read_md('openrosa', 'manifest/anonymous.md'),
        responses=open_api_200_ok_response(
            OpenRosaFormManifestResponse,
            media_type='application/xml',
            require_auth=False,
            validate_payload=False,
            raise_access_forbidden=False,
            error_media_type='application/xml',
        ),
        tags=['OpenRosa Form Manifest'],
        operation_id='manifest_anonymous',
    )
    @action(
        detail=False,
        methods=['GET'],
    )
    def manifest_anonymous(self, request, *args, **kwargs):
        return self.manifest(request, *args, **kwargs)

    @extend_schema(
        description=read_md('openrosa', 'manifest/data_collector.md'),
        responses=open_api_200_ok_response(
            OpenRosaFormManifestResponse,
            media_type='application/xml',
            require_auth=False,
            validate_payload=False,
            raise_access_forbidden=False,
            error_media_type='application/xml',
        ),
        tags=['OpenRosa Form Manifest'],
        operation_id='manifest_data_collector',
    )
    @action(
        detail=False,
        methods=['GET'],
        authentication_classes=[DataCollectorTokenAuthentication],
    )
    def manifest_dc(self, request, *args, **kwargs):
        return self.manifest(request, *args, **kwargs)

    @extend_schema(
        description=read_md('openrosa', 'manifest/authenticated.md'),
        responses=open_api_200_ok_response(
            OpenRosaFormManifestResponse,
            media_type='application/xml',
            require_auth=False,
            validate_payload=False,
            raise_access_forbidden=False,
            error_media_type='application/xml',
        ),
        tags=['OpenRosa Form Manifest'],
        operation_id='manifest_authenticated',
    )
    @action(detail=False, methods=['GET'])
    def manifest_authenticated(self, request, *args, **kwargs):
        return self.manifest(request, *args, **kwargs)

    @action(detail=True, methods=['GET'])
    def manifest(self, request, *args, **kwargs):
        """

        ViewSet for managing enketo form list

        Available actions:
        - xform_manifest (anonymous)         → GET /{username}/xformManifest/{id}
        - xform_manifest (authenticated)     → GET /xformManifest/{id}
        - xform_manifest (data collector)    → GET /collector/{token}/xformManifest/{id}

        Documentation:
        - docs/api/v2/manifest/list.md
        """
        xform = self.get_object()
        media_files = {}

        if request.method == 'HEAD':
            return self.get_response_for_head_request()

        # Retrieve all media files for the current form
        queryset = (
            MetaData.objects.select_related('xform__user')
            .only(
                'pk',
                'data_type',
                'data_value',
                'data_file',
                'data_filename',
                'file_hash',
                'from_kpi',
                'date_modified',
                'xform_id',
                'xform__user__username',
            )
            .filter(data_type__in=MetaData.MEDIA_FILES_TYPE, xform=xform)
        )

        # For expired paired-data entries, trigger async regeneration so the
        # background task updates the hash in MetaData. The current (possibly
        # stale) hash is served immediately; the next manifest request will
        # reflect the updated content once the task completes.
        for obj in queryset.all():
            self._trigger_paired_data_regen_if_expired(obj, request)
            media_files[obj.pk] = obj

        # Sort objects all the time because EE calculates a hash of the
        # whole manifest to detect any changes the next time EE downloads it.
        # If no files changed, but the order did, the hash of the manifest
        # would be different and EE would display:
        # > "A new version of this form has been downloaded"
        media_files = dict(sorted(media_files.items()))
        context = self.get_serializer_context()
        serializer = XFormManifestSerializer(
            media_files.values(),
            many=True,
            context=context,
            require_auth=not bool(kwargs.get('username')),
        )
        return Response(serializer.data, headers=self.get_openrosa_headers())

    @extend_schema(
        tags=['OpenRosa Form Media'],
        exclude=True,
    )
    @action(detail=True, methods=['GET'])
    def media(self, request, *args, **kwargs):
        xform = self.get_object()
        pk = kwargs.get('metadata')

        if not pk:
            raise Http404()

        meta_obj = get_object_or_404(
            MetaData,
            data_type__in=MetaData.MEDIA_FILES_TYPE,
            xform=xform,
            pk=pk,
        )
        if request.method == 'HEAD':
            return self.get_response_for_head_request()
        return get_media_file_response(meta_obj, request)

    @staticmethod
    def _enrich_xforms(xforms, assets_by_uid: dict, disclaimers_by_asset_pk: dict):
        """
        Generator that attaches pre-fetched asset and disclaimer data to each
        XForm as it is iterated, avoiding N+1 queries during serialization.
        """
        global_disclaimers = disclaimers_by_asset_pk.get(None, [])
        for xform in xforms:
            if not getattr(xform, '_cached_asset', None):
                asset = assets_by_uid.get(xform.kpi_asset_uid)
                if asset is not None:
                    per_asset = disclaimers_by_asset_pk.get(asset.pk, [])
                    asset._cached_disclaimers = per_asset + global_disclaimers
                xform._cached_asset = asset
            yield xform

    @staticmethod
    def _fetch_assets_and_disclaimers(asset_uids: list) -> tuple[dict, dict]:
        """
        Fetches all assets and their disclaimers in two bulk queries.

        Returns a tuple of:
        - assets_by_uid: dict mapping asset uid → Asset instance
        - disclaimers_by_asset_pk: dict mapping asset pk (or None for global) →
          list of disclaimer dicts
        """

        Asset = apps.get_model('kpi', 'Asset')

        assets_by_uid = {
            asset.uid: asset
            for asset in Asset.all_objects.only('pk', 'name', 'uid', 'owner_id')
            .filter(uid__in=asset_uids)
            .order_by()
        }

        asset_pks = [asset.pk for asset in assets_by_uid.values()]

        disclaimers_by_asset_pk: dict = {}
        for disclaimer in (
            FormDisclaimer.objects.annotate(language_code=F('language__code'))
            .values('language_code', 'message', 'default', 'hidden', 'asset_id')
            .filter(Q(asset__isnull=True) | Q(asset_id__in=asset_pks))
            .order_by('-hidden', '-asset_id', 'language_code')
        ):
            disclaimers_by_asset_pk.setdefault(disclaimer['asset_id'], []).append(
                disclaimer
            )

        return assets_by_uid, disclaimers_by_asset_pk

    @staticmethod
    def _trigger_paired_data_regen_if_expired(obj: MetaData, request: Request) -> bool:
        """
        Schedules async regeneration of a paired-data XML file if its content
        has exceeded `settings.PAIRED_DATA_EXPIRATION`. A distributed lock
        prevents duplicate tasks from being scheduled concurrently or while a
        previous task is still running.

        Only applies to `xml-external` (paired data) entries; all other
        metadata types are ignored.
        """
        if not obj.is_paired_data:
            return False

        timedelta = timezone.now() - obj.date_modified
        if timedelta.total_seconds() > settings.PAIRED_DATA_EXPIRATION:
            # Resolve the paired-data URL to extract `uid_paired_data`, which
            # is used as the lock key so that the Celery task can release it
            # upon successful completion.
            internal_url = obj.data_value.replace(settings.KOBOFORM_URL, '')
            try:
                uid_paired_data = resolve(internal_url).kwargs.get('uid_paired_data')
            except Resolver404:
                uid_paired_data = None

            # Use a distributed lock to prevent concurrent or repeated
            # regeneration. `cache.add()` is atomic (Redis SET NX): it returns
            # True only when the key did not exist and was successfully set.
            # The TTL covers worst-case generation time and ensures the lock
            # expires naturally if a K8s pod is killed mid-task.
            lock_key = f'regen_paired_data_{uid_paired_data}'
            if uid_paired_data and not cache.add(
                lock_key, True, timeout=settings.PAIRED_DATA_REGEN_LOCK_TIMEOUT
            ):
                # A task is already scheduled or running — serve the current
                # (possibly stale) content without queuing a duplicate task.
                return True
            # Update `date_modified` before triggering regeneration so that
            # subsequent requests do not immediately re-trigger while a task
            # or synchronous generation is in progress. The content may remain
            # stale for at most one expiry window in case of failure, which is
            # preferable to retrying on every manifest request.
            MetaData.objects.filter(pk=obj.pk).update(date_modified=timezone.now())
            # Trigger regeneration — async if the file already exists,
            # sync (blocking) on first creation or when content is cleared.
            # Note: in the sync case no Celery task is scheduled, so the lock
            # is never explicitly released and will remain held until
            # PAIRED_DATA_REGEN_LOCK_TIMEOUT expires. This is intentional:
            # the TTL exists precisely to cover both pod-kill scenarios and
            # long-running tasks, so relying on it for the (rare) sync path
            # is correct and avoids a window where a duplicate task could be
            # scheduled while Celery is still running.
            get_media_file_response(obj, request)
            return True

        return False
