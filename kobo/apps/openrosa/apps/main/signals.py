from django.conf import settings

from kobo.apps.kobo_auth.shortcuts import User
from kpi.utils.database import use_db
from kpi.utils.permissions import is_user_anonymous


def set_api_permissions(sender, instance=None, created=False, **kwargs):
    # TODO Get rid of this, only needed to KC unit tests. KPI does create
    #   KC object permissions when its calling `grant_kc_model_level_perms()`
    #   in `kpi.signals.save_kobocat_user()`
    from kobo.apps.openrosa.libs.utils.user_auth import set_api_permissions_for_user

    if is_user_anonymous(instance):
        return

    if created:
        with use_db(settings.OPENROSA_DB_ALIAS):
            if User.objects.filter(pk=instance.pk).exists() or settings.TESTING:
                set_api_permissions_for_user(instance)
