# coding: utf-8
from kpi.serializers import UserSerializer
from kpi.views.v2.user import UserViewSet as UserViewSetV2


class UserViewSet(UserViewSetV2):
    """
    ## This document is for a deprecated version of kpi's API.

    **Please upgrade to latest release `/api/v2/users/`**

    This viewset provides only the `detail` action; `list` is *not* provided to
    avoid disclosing every username in the database
    """

    serializer_class = UserSerializer
