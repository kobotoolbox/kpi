from django.urls import path, re_path

from kobo.apps.superuser_stats.views import (
    continued_usage_report,
    country_report,
    domain_report,
    forms_count_by_submission_report,
    media_storage,
    retrieve_reports,
    user_count_by_organization,
    user_details_report,
    user_report,
    user_statistics_report,
)


urlpatterns = [
    # Continued usage
    path(
        'reports/continued-usage/',
        continued_usage_report,
        name='continued_usage_report'
    ),
    re_path(
        r'^reports/continued-usage/(?P<base_filename>[^/]+)$',
        retrieve_reports,
    ),

    # Countries
    path('reports/countries/', country_report, name='countries_report'),
    re_path(r'^reports/countries/(?P<base_filename>[^/]+)$', retrieve_reports),

    # Domains
    path('reports/domains/', domain_report, name='domains_report'),
    re_path(r'^reports/domains/(?P<base_filename>[^/]+)$', retrieve_reports),

    # Forms by submissions count
    path(
        'reports/forms-by-submissions-count/',
        forms_count_by_submission_report,
        name='forms_by_submissions_count',
    ),
    re_path(
        r'^reports/forms-by-submissions-count/(?P<base_filename>[^/]+)$',
        retrieve_reports
    ),

    # Media storage
    path('reports/media-storage/', media_storage, name='media_storage_report'),
    re_path(
        r'^reports/media-storage/(?P<base_filename>[^/]+)$', retrieve_reports
    ),

    # Users count by organization
    path(
        'reports/users-count-by-organization/',
        user_count_by_organization,
        name='user_count_by_organization',
    ),
    re_path(r'^reports/users-count-by-organization/(?P<base_filename>[^/]+)$',
            retrieve_reports),

    # Users count by organization
    path('reports/users/', user_report, name='users_report'),
    re_path(r'^reports/users/(?P<base_filename>[^/]+)$', retrieve_reports),

    # Users statistics
    path(
        'reports/user-statistics/',
        user_statistics_report,
        name='user_statistics_report',
    ),
    re_path(
        r'^reports/user-statistics/(?P<base_filename>[^/]+)$', retrieve_reports
    ),

    # Users details
    path(
        'reports/user-details/', user_details_report, name='user_details_report'
    ),
    re_path(
        r'^reports/user-details/(?P<base_filename>[^/]+)$', retrieve_reports
    ),
]
