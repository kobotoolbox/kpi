from django.contrib.auth import get_user_model
from rest_framework import serializers


class UsernameHyperlinkField(serializers.HyperlinkedRelatedField):
    """
    Special hyperlinked field to handle when a query returns a dict rather than a User object
    """

    queryset = get_user_model().objects.all()
    view_name = 'user-kpi-detail'

    def get_url(self, obj, view_name, request, format):
        return self.reverse(
            view_name, kwargs={'username': obj}, request=request, format=format
        )
