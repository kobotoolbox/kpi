from constance import config
from django.db import transaction
from django.utils.timezone import now
from django.utils.translation import gettext as t
from rest_framework import status, viewsets, permissions
from rest_framework.response import Response

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.trash_bin.utils import move_to_trash
from kpi.serializers import CurrentUserSerializer
from kpi.versioning import APIV2Versioning


class CurrentUserViewSet(viewsets.ModelViewSet):
    """
    <pre class="prettyprint">
    <b>GET</b> /me/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/me/
    >
    >       {
    >           "username": string,
    >           "first_name": string,
    >           "last_name": string,
    >           "email": string,
    >           "server_time": "YYYY-MM-DDTHH:MM:SSZ",
    >           "date_joined": "YYYY-MM-DDTHH:MM:SSZ",
    >           "projects_url": "https://[kobocat]/{username}",
    >           "is_superuser": boolean,
    >           "gravatar": url,
    >           "is_staff": boolean,
    >           "last_login": "YYYY-MM-DDTHH:MM:SSZ",
    >           "extra_details": {
    >               "bio": string,
    >               "city": string,
    >               "name": string,
    >               "gender": string,
    >               "sector": string,
    >               "country": string,
    >               "twitter": string,
    >               "linkedin": string,
    >               "instagram": string,
    >               "organization": string,
    >               "last_ui_language": string,
    >               "organization_website": string,
    >               "newsletter_subscription": boolean,
    >           },
    >           "git_rev": {
    >               "short": boolean,
    >               "long": boolean,
    >               "branch": boolean,
    >               "tag": boolean,
    >           },
    >           "social_accounts": []
    >           "accepted_tos": boolean,
    >           "organization": {
    >               "url": string,
    >               "name": string,
    >               "uid": string,
    >           }
    >       }

    Update account details
    <pre class="prettyprint">
    <b>PATCH</b> /me/
    </pre>

    > Example
    >
    >       curl -X PATCH https://[kpi]/me/

    > Payload Example
    >
    >       {
    >           "first_name": "Bob"
    >       }

    Delete the entire account
    <pre class="prettyprint">
    <b>DELETE<b> /me/
    </pre>

    >   Example
    >
    >       curl -X DELETE https://[kpi]/me/

    > Payload Example
    >
    >       {
    >           "confirm": {user__extra_details__uid},
    >       }


    ### Current User Endpoint
    """
    queryset = User.objects.none()
    serializer_class = CurrentUserSerializer
    permission_classes = [permissions.IsAuthenticated]
    versioning_class = APIV2Versioning

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

        with transaction.atomic():
            # If user is already in trash, it should raise a `TrashIntegrityError`
            # but it should never happen since no non-active/trashed users should be
            # able to call this endpoint. A 403 should occur before.
            move_to_trash(
                request.user, [user], config.ACCOUNT_TRASH_GRACE_PERIOD, 'user'
            )
            request.user.is_active = False
            request.user.save(update_fields=['is_active'])
            request.user.extra_details.date_removal_requested = now()
            request.user.extra_details.save(
                update_fields=['date_removal_requested']
            )

        return Response(status=status.HTTP_204_NO_CONTENT)
