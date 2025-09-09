from kpi.versioning import APIAutoVersioning
from kpi.views.v2.authorized_application_user import (
    AuthorizedApplicationUserViewSet as AuthorizedApplicationUserViewSetSerializerV2,
)


class AuthorizedApplicationUserViewSet(AuthorizedApplicationUserViewSetSerializerV2):
    versioning_class = APIAutoVersioning
