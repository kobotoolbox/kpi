# coding: utf-8
from django.utils.timezone import now
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView


class TOSView(APIView):
    def post(self, request, *args, **kwargs):
        # Save current time in private_data
        # See also: AccountAdapter.save_user() in accounts/adapter.py, which
        # does the same thing if the ToS checkbox is checked during signup
        user_details = request.user.extra_details
        user_details.private_data['last_tos_accept_time'] = now().strftime(
            '%Y-%m-%dT%H:%M:%SZ'
        )
        user_details.save()

        return Response(status=status.HTTP_204_NO_CONTENT)
