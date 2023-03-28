# coding: utf-8
from constance import config
from django.contrib.auth.models import User
from django.db import transaction
from django.utils.timezone import now
from django.utils.translation import gettext as t
from rest_framework import status, viewsets
from rest_framework.response import Response

from kobo.apps.trash_bin.exceptions import TrashIntegrityError
from kobo.apps.trash_bin.utils import move_to_trash
from kpi.serializers import CurrentUserSerializer


class CurrentUserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.none()
    serializer_class = CurrentUserSerializer

    def get_object(self):
        return self.request.user

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()

        confirm = request.data.get('confirm')
        if confirm != user.extra_details.uid:
            return Response(
                {'detail': t('Invalid confirmation')},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = {'pk': user.pk, 'username': user.username}
        # If user is already in trash, it should raise a `TrashIntegrityError`
        # but it should never happen since no non-active/trashed users should be
        # able to call this endpoint. A 403 should occur before.
        move_to_trash(
            request.user, [user], config.ACCOUNT_TRASH_GRACE_PERIOD, 'user'
        )

        with transaction.atomic():
            request.user.is_active = False
            request.user.save(update_fields=['is_active'])
            request.user.extra_details.date_removal_request = now()
            request.user.extra_details.save(
                update_fields=['date_removal_request']
            )

        return Response(status=status.HTTP_204_NO_CONTENT)
