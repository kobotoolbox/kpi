from rest_framework import renderers


class OnlyGetBrowsableAPIRenderer(renderers.BrowsableAPIRenderer):
    """
    Custom renderer that modifies Django REST Framework's Browsable API behavior to
    only consider GET permissions.

    By default, Django REST Framework returns a 404 response for a GET request if the
    user lacks permission for DELETE or PATCH, even if they have explicit GET access.
    This behavior occurs because DELETE or PATCH permissions override GET, leading to
    unnecessary access restrictions.

    This renderer changes that behavior by preventing DELETE and PATCH actions from
    being exposed in the Browsable API.

    This ensures that users with GET access can still retrieve and browse data through
    the Django  Browsable API without being blocked due to stricter permissions on
    destructive actions.
    """

    def show_form_for_method(self, view, method, request, obj):

        if request._request.META.get('REQUEST_METHOD') == 'GET':  # noqa
            return method == 'GET'

        return super().show_form_for_method(view, method, request, obj)
