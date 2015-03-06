from rest_framework.routers import DefaultRouter, Route, DynamicDetailRoute

class SurveyAssetRouter(DefaultRouter):
    routes = [
        Route(
            url=r'^{prefix}/$',
            mapping={'get': 'list'},
            name='{basename}-list',
            initkwargs={'suffix': 'List'}
        ),
        Route(
            url=r'^{prefix}/{lookup}/$',
           mapping={'get': 'retrieve'},
           name='{basename}-detail',
           initkwargs={'suffix': 'Detail'}
        ),
        Route(
            # (?P<uid>[A-Za-z0-9]{8})@(?P<vid>\d+)
            url=r'^{prefix}/{lookup}@(?P<version_id>\d+)/$',
            mapping={'get': 'retrieve_version'},
            name='{basename}version-detail',
            initkwargs={}
        ),
        DynamicDetailRoute(
            url=r'^{prefix}/{lookup}/{methodnamehyphen}/$',
            name='{basename}-{methodnamehyphen}',
            initkwargs={}
        )
    ]