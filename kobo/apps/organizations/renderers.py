from rest_framework import renderers


class OnlyGetBrowsableAPIRenderer(renderers.BrowsableAPIRenderer):

    def show_form_for_method(self, view, method, request, obj):

        if request._request.META.get('REQUEST_METHOD') == 'GET':
            return method == 'GET'

        return super().show_form_for_method(view, method, request, obj)
