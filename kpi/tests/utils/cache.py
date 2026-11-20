from django.http import HttpResponseBase


def assert_not_stored(response: HttpResponseBase):
    """
    Assert that `response` tells the browser not to store it.
    """
    directives = {
        directive.strip().lower() for directive in response['Cache-Control'].split(',')
    }
    assert {'no-store', 'no-cache', 'must-revalidate', 'private'} <= directives
