from ..exceptions import InvalidPasswordAPIException


class ValidationPasswordPermissionMixin:

    def validate_password(self, request):

        if request.user.is_anonymous:
            return

        try:
            extra_details = request.user.extra_details
        except request.user.extra_details.RelatedObjectDoesNotExist:
            # if user has not extra details, admin has not been able to set
            # `validated_password`. Let's consider it as True.
            return

        if extra_details.validated_password:
            return

        raise InvalidPasswordAPIException
