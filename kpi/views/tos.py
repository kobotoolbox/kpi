# coding: utf-8
from django.utils.timezone import now
from django.db import transaction
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView


class TOSView(APIView):
    def post(self, request, *args, **kwargs):
        # Save current time in private_data
        with transaction.atomic():
            request.user.extra_details.private_data[
                'current_time'
            ] = now().strftime('%Y-%m-%dT%H:%M:%SZ')
            request.user.extra_details.save()

        return Response(status=status.HTTP_204_NO_CONTENT)
