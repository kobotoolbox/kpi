import requests
from django.conf import settings


# separated out for easier mocking/testing
def create_enketo_links(data):
    return requests.post(
        f'{settings.ENKETO_URL}/{settings.ENKETO_SURVEY_ENDPOINT}',
        # bare tuple implies basic auth
        auth=(settings.ENKETO_API_KEY, ''),
        data=data,
    )
