from rest_framework.urlpatterns import format_suffix_patterns
from kpi.views import SurveyAssetViewSet, UserViewSet, api_root, CollectionViewSet
from rest_framework import renderers
from django.conf.urls import url, include

survey_asset_list = SurveyAssetViewSet.as_view({
    'get': 'list',
    'post': 'create'
})
survey_asset_detail = SurveyAssetViewSet.as_view({
    'get': 'retrieve',
    'put': 'update',
    'patch': 'partial_update',
    'delete': 'destroy'
})
survey_asset_highlight = SurveyAssetViewSet.as_view({
    'get': 'highlight'
}, renderer_classes=[renderers.StaticHTMLRenderer])

user_list = UserViewSet.as_view({
    'get': 'list',
})
user_detail = UserViewSet.as_view({
    'get': 'retrieve',
})

collection_list = CollectionViewSet.as_view({
    'get': 'list',
    'post': 'create',
})
collection_detail = CollectionViewSet.as_view({
    'get': 'retrieve',
    'put': 'update',
    'patch': 'partial_update',
    'delete': 'destroy',
})


urlpatterns = format_suffix_patterns([
    url(r'^$', api_root, name='api-root'),

    url(r'^survey_assets/$', survey_asset_list, name='surveyasset-list'),
    url(r'^survey_assets/(?P<pk>[0-9]+)/$', survey_asset_detail, name='surveyasset-detail'),
    url(r'^survey_assets/(?P<pk>[0-9]+)/highlight/$', survey_asset_highlight, name='surveyasset-highlight'),

    url(r'^collections/$', collection_list, name='collection-list'),
    url(r'^collections/(?P<pk>[0-9]+)/$', collection_detail, name='collection-detail'),

    url(r'^users/$', user_list, name='user-list'),
    url(r'^users/(?P<pk>[0-9]+)/$', user_detail, name='user-detail')
])

urlpatterns += [
    url(r'^api-auth/', include('rest_framework.urls',
                               namespace='rest_framework')),
]
