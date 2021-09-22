from rest_framework.decorators import action, api_view
from rest_framework import renderers, status
from rest_framework.response import Response
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist

from kpi.models import Asset
from veritree.models import Organization
from veritree.pipeline import veritree_org_asset_sync_with_all_active_members, veritree_org_asset_unlink_with_all_active_members

@api_view(('POST',))
@action(detail=False, methods=['POST'], renderer_classes=[renderers.JSONRenderer])
def veritree_org_asset_link(request, *args, **kwargs):
    """
    Assigns all permissions at once for the same asset.

    :param request:
    :return: JSON
    """
    data = request.data
    if 'asset_uid' not in data or 'org_id' not in data:
        http_status = status.HTTP_400_BAD_REQUEST
        response = {'detail': ("asset uid and org id not in request body")}
        return Response(response, status=http_status)

    try:
        asset = Asset.objects.get(uid=data['asset_uid'])
    except ObjectDoesNotExist:
        http_status = status.HTTP_400_BAD_REQUEST
        response = {'detail': ("asset with that uid does not exist")}
        return Response(response, status=http_status)
    
    try:
        org = Organization.objects.get(veritree_id=data['org_id'])
    except ObjectDoesNotExist:
        http_status = status.HTTP_400_BAD_REQUEST
        response = {'detail': ("Veritree org with that veritree org id does not exist")}
        return Response(response, status=http_status)

    with transaction.atomic():
        org.assets.add(asset)
        veritree_org_asset_sync_with_all_active_members(asset, org)
    
    return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(('POST',))
@action(detail=False, methods=['POST'], renderer_classes=[renderers.JSONRenderer])
def veritree_org_asset_unlink(request, *args, **kwargs):
    """
    Assigns all permissions at once for the same asset.

    :param request:
    :return: JSON
    """
    data = request.POST
    if 'asset_uid' not in data or 'org_id' not in data:
        http_status = status.HTTP_400_BAD_REQUEST
        response = {'detail': ("asset uid and org id not in request body")}
        return Response(response, status=http_status)

    try:
        asset = Asset.objects.get(uid=data['asset_uid'])
    except ObjectDoesNotExist:
        http_status = status.HTTP_400_BAD_REQUEST
        response = {'detail': ("asset with that uid does not exist")}
        return Response(response, status=http_status)
    
    try:
        org = Organization.objects.get(veritree_id=data['org_id'])
    except ObjectDoesNotExist:
        http_status = status.HTTP_400_BAD_REQUEST
        response = {'detail': ("Veritree org with that veritree org id does not exist")}
        return Response(response, status=http_status)

    with transaction.atomic():
        org.assets.remove(asset)
        veritree_org_asset_unlink_with_all_active_members(asset, org)
    
    return Response(status=status.HTTP_204_NO_CONTENT)


        
