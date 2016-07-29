from rest_framework.routers import DefaultRouter, Route, DynamicDetailRoute

# class AssetRouter(DefaultRouter):
#     routes = [
#         Route(
#             url=r'^{prefix}/$',
#             mapping={
#                 'get': 'list',
#                 'post': 'create'
#             },
#             name='{basename}-list',
#             initkwargs={'suffix': 'List'}
#         ),
#         Route(
#             url=r'^{prefix}/{lookup}/$',
#             mapping={
#                 'get': 'retrieve',
#                 'put': 'update',
#                 'patch': 'partial_update',
#                 'delete': 'destroy'
#             },
#            name='{basename}-detail',
#            initkwargs={'suffix': 'Detail'}
#         ),
#         DynamicDetailRoute(
#             url=r'^{prefix}/{lookup}/{methodnamehyphen}/$',
#             name='{basename}-{methodnamehyphen}',
#             initkwargs={}
#         )
#     ]

# Route(
#     # (?P<uid>[A-Za-z0-9]{8})@(?P<vid>\d+)
#     url=r'^{prefix}/{lookup}@(?P<version_id>\d+)/$',
#     mapping={'get': 'retrieve_version'},
#     name='{basename}version-detail',
#     initkwargs={}
# ),
