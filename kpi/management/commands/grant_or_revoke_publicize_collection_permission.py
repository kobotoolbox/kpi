import sys
from optparse import make_option

from django.contrib.auth.models import Permission
from django.core.management.base import BaseCommand
from django.contrib.contenttypes.models import ContentType
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User

from kpi.models import Collection


class Command(BaseCommand):
    """
    Grant or revoke `publicize_collection` permission to a user
    """

    option_list = BaseCommand.option_list + (
        make_option('--username',
                    action='store',
                    dest='username',
                    default=False,
                    help="Add username i.e --username <username>"),) + (
        make_option('--action',
                    action='store',
                    dest='action',
                    default=False,
                    help="Add action i.e --action <grant|revoke>"),)

    def grant_publicize_collection_permission(
            self, user, content_type, permission):
        username = user.username
        if user.has_perm('kpi.publicize_collection'):
            sys.stdout.write(
                ("%s already has `publicize_collection` permission"
                 % username)
            )
        else:
            user.user_permissions.add(permission)

            # Request new instance of User
            # Be aware that user.refresh_from_db() won't clear the cache.
            # https://docs.djangoproject.com/en/3.0/topics/auth/default/#permission-caching
            user = get_object_or_404(User, username=username)
            if user.has_perm('kpi.publicize_collection'):
                sys.stdout.write(
                    ("`publicize_collection` permission has been granted to "
                     "%s" % username)
                )

    def revoke_publicize_collection_permission(
            self, user, content_type, permission):
        username = user.username
        if not user.has_perm('kpi.publicize_collection'):
            sys.stdout.write(
                ("%s doesn't have `publicize_collection` permission "
                 % username)
            )
        else:
            user.user_permissions.remove(permission)
            user = get_object_or_404(User, username=username)
            if not user.has_perm('kpi.publicize_collection'):
                sys.stdout.write(
                    ("`publicize_collection` permission has been revoked from "
                     "%s" % username)
                )

    def handle(self, *args, **options):
        username = options.get('username')
        action = options.get('action')
        if username and action:
            if action not in ['grant', 'revoke']:
                sys.stdout.write("Invalid action. Please use grant or revoke")
                return

            user = get_object_or_404(User, username=username)
            content_type = ContentType.objects.get_for_model(Collection)
            permission, created = Permission.objects.get_or_create(
                codename='publicize_collection',
                defaults={
                    'content_type': content_type,
                    'name': 'Can publicize collection'
                },
            )

            if created:
                sys.stdout.write(
                    ("Permission `publicize_collection` has successfully "
                     "been created")
                )

            if action == 'grant':
                self.grant_publicize_collection_permission(
                    user, content_type, permission
                )

            elif action == 'revoke':
                self.revoke_publicize_collection_permission(
                    user, content_type, permission
                )
        else:
            sys.stdout.write("please provide a username")
