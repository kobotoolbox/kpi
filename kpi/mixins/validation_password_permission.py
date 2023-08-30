from ..exceptions import InvalidPasswordAPIException


class ValidationPasswordPermissionMixin:

    def validate_password(self, request):

        if request.user.is_anonymous:
            return

        try:
            extra_details = request.user.extra_details
        except request.user.extra_details.RelatedObjectDoesNotExist:
            # validated_password defaults to True and only becomes False if set
            # by an administrator. If extra_details does not exist, then
            # there's no way the administrator ever intended validated_password
            # to be False for this user
            return

        if extra_details.validated_password:
            return

        raise InvalidPasswordAPIException
