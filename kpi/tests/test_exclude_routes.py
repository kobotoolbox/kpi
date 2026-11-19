from django.core.exceptions import ImproperlyConfigured
from django.http import HttpResponse
from django.test import SimpleTestCase
from django.urls import URLResolver, include, path
from django.urls.exceptions import Resolver404
from django.urls.resolvers import RegexPattern
from django.views import View

from kpi.utils.urls import exclude_routes, replace_route_views


def view(request):
    return HttpResponse()


def build_patterns():
    return [
        path('top/', view, name='top'),
        path(
            'outer/',
            include(
                (
                    [
                        path('keep/', view, name='keep'),
                        path('drop/', view, name='drop'),
                    ],
                    'app',
                ),
                namespace='ns',
            ),
        ),
    ]


def resolver_for(patterns):
    return URLResolver(RegexPattern(r'^/'), patterns)


class ExcludeRoutesTestCase(SimpleTestCase):

    def test_excludes_a_nested_route_and_keeps_the_others(self):
        resolver = resolver_for(exclude_routes(build_patterns(), {'drop'}))

        with self.assertRaises(Resolver404):
            resolver.resolve('/outer/drop/')
        assert resolver.resolve('/outer/keep/').url_name == 'keep'
        assert resolver.resolve('/top/').url_name == 'top'

    def test_keeps_namespaces_and_app_names(self):
        resolver = resolver_for(exclude_routes(build_patterns(), {'drop'}))

        match = resolver.resolve('/outer/keep/')

        assert match.namespaces == ['ns']
        assert match.app_names == ['app']
        assert resolver.reverse_dict.getlist('top')
        assert 'ns' in resolver.namespace_dict

    def test_excludes_a_top_level_route(self):
        resolver = resolver_for(exclude_routes(build_patterns(), {'top'}))

        with self.assertRaises(Resolver404):
            resolver.resolve('/top/')

    def test_leaves_the_original_patterns_untouched(self):
        patterns = build_patterns()

        exclude_routes(patterns, {'drop'})

        assert resolver_for(patterns).resolve('/outer/drop/').url_name == 'drop'

    def test_unknown_name_raises(self):
        # A route renamed upstream must not quietly come back
        with self.assertRaisesMessage(
            ImproperlyConfigured, 'No route to exclude is named missing'
        ):
            exclude_routes(build_patterns(), {'drop', 'missing'})


class ClientView(View):
    client = None

    def get(self, request):
        return HttpResponse(self.client)


class KpiClientView(ClientView):
    pass


def build_class_based_patterns():
    # The same route name in two namespaces, like allauth's `reauthenticate`
    return [
        path(
            f'{client}/',
            include(
                (
                    [path('shared/', ClientView.as_view(client=client), name='shared')],
                    'app',
                ),
                namespace=client,
            ),
        )
        for client in ('one', 'two')
    ]


class QualifiedRouteNameTestCase(SimpleTestCase):

    def test_qualified_name_only_matches_its_namespace(self):
        resolver = resolver_for(
            exclude_routes(build_class_based_patterns(), {'one:shared'})
        )

        with self.assertRaises(Resolver404):
            resolver.resolve('/one/shared/')
        assert resolver.resolve('/two/shared/').url_name == 'shared'

    def test_bare_name_matches_every_namespace(self):
        resolver = resolver_for(
            exclude_routes(build_class_based_patterns(), {'shared'})
        )

        for url in ('/one/shared/', '/two/shared/'):
            with self.assertRaises(Resolver404):
                resolver.resolve(url)

    def test_name_cannot_match_a_namespace_partially(self):
        with self.assertRaisesMessage(
            ImproperlyConfigured, 'No route to exclude is named ne:shared'
        ):
            exclude_routes(build_class_based_patterns(), {'ne:shared'})

    def test_several_names_matching_one_route_raise(self):
        with self.assertRaisesMessage(
            ImproperlyConfigured, 'Several names match the one:shared route'
        ):
            exclude_routes(build_class_based_patterns(), {'shared', 'one:shared'})


class ReplaceRouteViewsTestCase(SimpleTestCase):

    def test_replaces_the_view_and_keeps_the_route(self):
        resolver = resolver_for(
            replace_route_views(
                build_class_based_patterns(), {'two:shared': KpiClientView}
            )
        )

        replaced = resolver.resolve('/two/shared/')
        untouched = resolver.resolve('/one/shared/')

        assert replaced.func.view_class is KpiClientView
        assert replaced.url_name == 'shared'
        assert replaced.namespaces == ['two']
        assert replaced.app_names == ['app']
        assert untouched.func.view_class is ClientView

    def test_replacement_keeps_the_original_init_kwargs(self):
        resolver = resolver_for(
            replace_route_views(build_class_based_patterns(), {'shared': KpiClientView})
        )

        for client in ('one', 'two'):
            match = resolver.resolve(f'/{client}/shared/')
            assert match.func.view_class is KpiClientView
            assert match.func.view_initkwargs == {'client': client}

    def test_replacement_must_subclass_the_original_view(self):
        with self.assertRaisesMessage(
            ImproperlyConfigured, 'View does not subclass the view of the shared route'
        ):
            replace_route_views(build_class_based_patterns(), {'shared': View})

    def test_function_view_cannot_be_replaced(self):
        with self.assertRaisesMessage(
            ImproperlyConfigured,
            'KpiClientView does not subclass the view of the top route',
        ):
            replace_route_views(build_patterns(), {'top': KpiClientView})

    def test_leaves_the_original_patterns_untouched(self):
        patterns = build_class_based_patterns()

        replace_route_views(patterns, {'shared': KpiClientView})

        match = resolver_for(patterns).resolve('/one/shared/')
        assert match.func.view_class is ClientView

    def test_unknown_name_raises(self):
        with self.assertRaisesMessage(
            ImproperlyConfigured, 'No route to replace is named missing'
        ):
            replace_route_views(build_patterns(), {'missing': KpiClientView})
