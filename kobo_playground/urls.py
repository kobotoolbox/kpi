from rest_framework.urlpatterns import format_suffix_patterns
from kpi.views import SurveyAssetViewSet, UserViewSet, api_root, CollectionViewSet
from rest_framework.routers import DefaultRouter
from rest_framework import renderers
from django.conf.urls import url, include

router = DefaultRouter()
router.register(r'survey_assets', SurveyAssetViewSet)
router.register(r'collections', CollectionViewSet)
router.register(r'users', UserViewSet)

urlpatterns = [
    url(r'^$', api_root, name='api-root'),
    url(r'^', include(router.urls)),
    url(r'^api-auth/', include('rest_framework.urls',
                               namespace='rest_framework')),
]

# from django.http import HttpResponse

# survey_asset_list = SurveyAssetViewSet.as_view({
#     'get': 'list',
#     'post': 'create'
# })
# survey_asset_detail = SurveyAssetViewSet.as_view({
#     'get': 'retrieve',
#     'put': 'update',
#     'patch': 'partial_update',
#     'delete': 'destroy'
# })

# survey_asset_table_view = SurveyAssetViewSet.as_view({
#     'get': 'table_view'
# }, renderer_classes=[renderers.StaticHTMLRenderer])

# user_list = UserViewSet.as_view({
#     'get': 'list',
# })
# user_detail = UserViewSet.as_view({
#     'get': 'retrieve',
# })

# collection_list = CollectionViewSet.as_view({
#     'get': 'list',
#     'post': 'create',
# })
# collection_detail = CollectionViewSet.as_view({
#     'get': 'retrieve',
#     'put': 'update',
#     'patch': 'partial_update',
#     'delete': 'destroy',
# })



#  url(r'^xyz/(?P<uid>[A-Za-z0-9]{8})@(?P<vid>\d+)/$', abc, name='abc-version'),

# urlpatterns += format_suffix_patterns([
#     # url(r'^survey_assets/$', survey_asset_list, name='surveyasset-list'),
#     # url(r'^survey_assets/(?P<vuid>[A-Za-z0-9]{8})@(?P<vnum>\d+)/$', survey_asset_detail_uid, name='surveyassetuid-detail'),
#     # url(r'^survey_assets/(?P<pk>[A-Za-z0-9]+)/$', survey_asset_detail, name='surveyasset-detail'),
# ], allowed=[
#     'json',
#     'ssjson',
#     'mdtable',
#     'xml',
#     # 'xls',
#     # 'enketopreviewlink',
# ])

# urlpatterns += [url(r'^survey_assets/(?P<pk>[0-9]+)/table_view/$', survey_asset_table_view, name='surveyasset-tableview'),]

# urlpatterns += format_suffix_patterns([
#     url(r'^collections/$', collection_list, name='collection-list'),
#     url(r'^collections/(?P<pk>[0-9]+)/$', collection_detail, name='collection-detail'),

#     url(r'^users/$', user_list, name='user-list'),
#     url(r'^users/(?P<pk>[0-9]+)/$', user_detail, name='user-detail')
# ])
