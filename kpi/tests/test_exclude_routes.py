from django.core.exceptions import ImproperlyConfigured
from django.http import HttpResponse
from django.test import SimpleTestCase
from django.urls import URLResolver, include, path
from django.urls.exceptions import Resolver404
from django.urls.resolvers import RegexPattern

from kpi.utils.urls import exclude_routes


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
