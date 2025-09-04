from django.contrib.auth.models import AnonymousUser
from rest_framework.authentication import BaseAuthentication

from kobo.apps.data_collectors.models import DataCollector
from kobo.apps.openrosa.apps.logger.models import XForm
from kpi.constants import PERM_ADD_SUBMISSIONS


class DataCollectorUser(AnonymousUser):
    @property
    def is_authenticated(self):
        # Always return True. This is a way to tell if
        # the user has been authenticated in permissions
        return True

    def __init__(self, name=None, assets=None):
        self.name = name
        self.assets = assets

    def has_perm(self, perm, obj=...):
        if perm != PERM_ADD_SUBMISSIONS:
            return False
        if not isinstance(obj, XForm):
            return False
        return obj.kpi_asset_uid in self.assets


class DataCollectorTokenAuthentication(BaseAuthentication):
    def authenticate(self, request):
        context = request.parser_context
        kwargs = context.get('kwargs', {})
        token = kwargs.get('token', None)
        if not token:
            return None
        return self.authenticate_credentials(token)

    def authenticate_credentials(self, key):
        try:
            collector = DataCollector.objects.get(token=key)
            server_user = DataCollectorUser()
            group = collector.group
            if group:
                server_user.assets = list(group.assets.values_list('uid', flat=True))
                server_user.name = collector.name
            return server_user, key
        except DataCollector.DoesNotExist:
            raise DataCollector.AuthenticationFailed('Invalid token.')
