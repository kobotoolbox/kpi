from django.core.management.base import BaseCommand
from django.db import transaction, connection
from django.contrib.auth.models import User

from kpi.deployment_backends.kc_access.shadow_models import ShadowModel
from kpi.deployment_backends.kc_access.utils import delete_kc_users
## Auth token
# Asset
# social auth - usersocialauth
# auth user - User Permissions
# Hub - extra user detail

class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument('id', nargs='+', type=int)

    def handle(self, *args, **options):
        # Grab user id from options
        if not options['id']:
            return
        with transaction.atomic():
            for user_id in options['id']:
                user = User.objects.get(id=user_id)
                links = [f for f in user._meta.get_fields() if (f.one_to_many or f.one_to_one or f.many_to_many)]
                for link in links:
                    if link.one_to_one:
                        try:
                            obj = getattr(user, link.name)
                            if not isinstance(obj, ShadowModel):
                                obj.delete()
                        except AttributeError:
                            pass
                    if link.one_to_many:
                        try:
                            objs = getattr(user, link.name).all()
                            if objs.exists() and not isinstance(objs[0], ShadowModel):
                                objs.delete()
                        except AttributeError:
                            pass
                    if link.many_to_many:
                        try:
                            objs = getattr(user, link.name).clear()
                        except AttributeError:
                            pass
                delete_kc_users([user_id])
                with connection.cursor() as cursor:
                    cursor.execute("DELETE FROM auth_user WHERE id=%d" % (user_id))
            
            # Delete User with straight SQL
            