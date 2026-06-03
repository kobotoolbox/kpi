# coding: utf-8
from corsheaders.signals import check_request_enabled

from .models import CorsModel


def cors_allow_external_sites(sender, request, **kwargs):
    origin = request.headers.get('origin')
    return CorsModel.objects.filter(cors=origin).exists()


check_request_enabled.connect(cors_allow_external_sites)
