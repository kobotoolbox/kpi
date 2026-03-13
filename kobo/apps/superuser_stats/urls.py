from django.urls import path

from kobo.apps.superuser_stats.views import (
    continued_usage_report,
    country_report,
    domain_report,
    forms_count_by_submission_report,
    media_storage,
    retrieve_reports,
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
    path(
        'reports/continued-usage/<str:base_filename>',
        retrieve_reports,
    ),

    # Countries
    path('reports/countries/', country_report, name='countries_report'),
    path('reports/countries/<str:base_filename>', retrieve_reports),

    # Domains
    path('reports/domains/', domain_report, name='domains_report'),
    path('reports/domains/<str:base_filename>', retrieve_reports),

    # Forms by submissions count
    path(
        'reports/forms-by-submissions-count/',
        forms_count_by_submission_report,
        name='forms_by_submissions_count',
    ),
    path(
        'reports/forms-by-submissions-count/<str:base_filename>',
        retrieve_reports
    ),

    # Media storage
    path('reports/media-storage/', media_storage, name='media_storage_report'),
    path(
        'reports/media-storage/<str:base_filename>', retrieve_reports
    ),

    # User report
    path('reports/users/', user_report, name='users_report'),
    path('reports/users/<str:base_filename>', retrieve_reports),

    # Users statistics
    path(
        'reports/user-statistics/',
        user_statistics_report,
        name='user_statistics_report',
    ),
    path(
        'reports/user-statistics/<str:base_filename>', retrieve_reports
    ),

    # Users details
    path(
        'reports/user-details/', user_details_report, name='user_details_report'
    ),
    path(
        'reports/user-details/<str:base_filename>', retrieve_reports
    ),
]
