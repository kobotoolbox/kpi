import sys
from optparse import make_option
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from kpi.utils.permissions import grant_default_model_level_perms


class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument('--username',
                    action='store',
                    dest='username',
                    default=False,
                    help="Add username i.e --username <username>")

    def handle(self, *args, **options):
        username = options.get('username')
        if username:
            users = User.objects.filter(username=username)
            if users:
                grant_default_model_level_perms(users[0])
                sys.stdout.write("done")
            else:
                sys.stdout.write("user does not exist")
        else:
            sys.stdout.write("please provide a username")
