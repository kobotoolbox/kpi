from django.urls import include, path, re_path
from django.views.generic import RedirectView
from django.views.i18n import JavaScriptCatalog

from kobo.apps.openrosa import koboform
from kobo.apps.openrosa.apps.api.viewsets.xform_list_api import XFormListApi
from kobo.apps.openrosa.apps.api.viewsets.xform_submission_api import XFormSubmissionApi
from kobo.apps.openrosa.apps.logger.views import (
    bulksubmission,
    bulksubmission_form,
    download_jsonform,
    download_xlsform,
)

# exporting stuff
from kobo.apps.openrosa.apps.viewer.views import (
    briefcase_attachment_url,
    create_export,
    delete_export,
    export_download,
    export_list,
    export_progress,
)

urlpatterns = [
    # change Language
    path('i18n/', include('django.conf.urls.i18n')),
    # main website views
    path('', RedirectView.as_view(url=koboform.redirect_url('/')), name='home'),
    re_path(
        r'^attachment/briefcase/(?P<att_uid>[^/]+)$',
        briefcase_attachment_url,
        name='briefcase-attachment',
    ),
    path(
        'jsi18n/',
        JavaScriptCatalog.as_view(
            packages=['kobo.apps.openrosa.apps.main', 'kobo.apps.openrosa.apps.viewer']
        ),
        name='javascript-catalog',
    ),
    path(
        '<str:username>/',
        RedirectView.as_view(url=koboform.redirect_url('/')),
        name='user_profile',
    ),
    # exporting stuff
    re_path(
        r'^(?P<username>\w+)/exports/(?P<id_string>[^/]+)/(?P<export_type>\w+)'
        r'/new$',
        create_export,
        name='create_export',
    ),
    re_path(
        r'^(?P<username>\w+)/exports/(?P<id_string>[^/]+)/(?P<export_type>\w+)'
        r'/delete$',
        delete_export,
        name='delete_export',
    ),
    re_path(
        r'^(?P<username>\w+)/exports/(?P<id_string>[^/]+)/(?P<export_type>\w+)'
        r'/progress$',
        export_progress,
        name='export_progress',
    ),
    re_path(
        r'^(?P<username>\w+)/exports/(?P<id_string>[^/]+)/(?P<export_type>\w+)' r'/$',
        export_list,
        name='export_list',
    ),
    re_path(
        r'^(?P<username>\w+)/exports/(?P<id_string>[^/]+)/(?P<export_type>\w+)'
        '/(?P<filename>[^/]+)$',
        export_download,
        name='export_download',
    ),
    # odk data urls
    path(
        'submission',
        XFormSubmissionApi.as_view(
            {'post': 'create_authenticated', 'head': 'create_authenticated'}
        ),
        name='submissions',
    ),
    path(
        'formList',
        XFormListApi.as_view({'get': 'form_list_authenticated'}),
        name='form-list',
    ),
    re_path(
        r'^(?P<username>\w+)/formList$',
        XFormListApi.as_view({'get': 'form_list_anonymous'}),
        name='form-list',
    ),
    path(
        'collector/<str:token>/formList',
        XFormListApi.as_view({'get': 'form_list_dc'}),
        name='form-list',
    ),
    re_path(
        r'^xformsManifest/(?P<pk>[\d+^/]+)$',
        XFormListApi.as_view({'get': 'manifest_authenticated'}),
        name='manifest-url',
    ),
    re_path(
        r'^(?P<username>\w+)/xformsManifest/(?P<pk>[\d+^/]+)$',
        XFormListApi.as_view({'get': 'manifest_anonymous'}),
        name='manifest-url',
    ),
    re_path(
        r'^collector/(?P<token>[^/]+)/xformsManifest/(?P<pk>[\d+^/]+)$',
        XFormListApi.as_view({'get': 'manifest_dc'}),
        name='manifest-url',
    ),
    re_path(
        r'^(?P<username>\w+)/xformsMedia/(?P<pk>[\d+^/]+)' r'/(?P<metadata>[\d+^/.]+)$',
        XFormListApi.as_view({'get': 'media'}),
        name='xform-media',
    ),
    re_path(
        r'^(?P<username>\w+)/xformsMedia/(?P<pk>[\d+^/]+)'
        r'/(?P<metadata>[\d+^/.]+)\.(?P<format>[a-z0-9]+)$',
        XFormListApi.as_view({'get': 'media'}),
        name='xform-media',
    ),
    re_path(
        r'^collector/(?P<token>[^/]+)/xformsMedia/(?P<pk>[\d+^/]+)'
        r'/(?P<metadata>[\d+^/.]+)$',
        XFormListApi.as_view({'get': 'media'}),
        name='xform-media',
    ),
    re_path(
        r'^collector/(?P<token>[^/]+)/xformsMedia/(?P<pk>[\d+^/]+)'
        r'/(?P<metadata>[\d+^/.]+)\.(?P<format>[a-z0-9]+)$',
        XFormListApi.as_view({'get': 'media'}),
        name='xform-media',
    ),
    re_path(
        r'^xformsMedia/(?P<pk>[\d+^/]+)/(?P<metadata>[\d+^/.]+)$',
        XFormListApi.as_view({'get': 'media'}),
        name='xform-media',
    ),
    re_path(
        r'^xformsMedia/(?P<pk>[\d+^/]+)/(?P<metadata>[\d+^/.]+)\.'
        r'(?P<format>[a-z0-9]+)$',
        XFormListApi.as_view({'get': 'media'}),
        name='xform-media',
    ),
    re_path(
        r'^(?P<username>\w+)/submission$',
        XFormSubmissionApi.as_view(
            {'post': 'create_anonymous', 'head': 'create_anonymous'}
        ),
        name='submissions',
    ),
    path(
        'collector/<str:token>/submission',
        XFormSubmissionApi.as_view(
            {'post': 'create_data_collector', 'head': 'create_data_collector'}
        ),
        name='submissions',
    ),
    re_path(r'^(?P<username>\w+)/bulk-submission$', bulksubmission),
    re_path(r'^(?P<username>\w+)/bulk-submission-form$', bulksubmission_form),
    re_path(
        r'^forms/(?P<pk>[\d+^/]+)/form\.xml$',
        XFormListApi.as_view({'get': 'retrieve'}),
        name='download_xform',
    ),
    re_path(
        r'^(?P<username>\w+)/forms/(?P<pk>[\d+^/]+)/form\.xml$',
        XFormListApi.as_view({'get': 'retrieve'}),
        name='download_xform',
    ),
    re_path(
        r'^(?P<username>\w+)/forms/(?P<id_string>[^/]+)/form\.xls$',
        download_xlsform,
        name='download_xlsform',
    ),
    re_path(
        r'^(?P<username>\w+)/forms/(?P<id_string>[^/]+)/form\.json',
        download_jsonform,
        name='download_jsonform',
    ),
    re_path(
        r'^collector/(?P<token>[^/]+)/forms/(?P<pk>[\d+^/]+)/form\.xml$',
        XFormListApi.as_view({'get': 'retrieve'}),
        name='download_xform',
    ),
    re_path(r'^favicon\.ico', RedirectView.as_view(url='/static/images/favicon.ico')),
]
