from django.contrib.auth.models import User
from kpi.deployment_backends.kc_access.shadow_models import KobocatUser

usernames = [x.strip() for x in open('../eu-usernames.txt').readlines()]
all_users_qs = User.objects.filter(username__in=usernames)
all_kc_users_qs = KobocatUser.objects.filter(username__in=usernames)
