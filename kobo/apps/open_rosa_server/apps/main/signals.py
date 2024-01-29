# coding: utf-8
def set_api_permissions(sender, instance=None, created=False, **kwargs):
    from kobo.apps.open_rosa_server.libs.utils.user_auth import set_api_permissions_for_user
    if created:
        set_api_permissions_for_user(instance)
