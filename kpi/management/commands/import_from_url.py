# coding: utf-8
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User

from kpi.constants import ASSET_TYPE_COLLECTION
from kpi.models import ImportTask


class Command(BaseCommand):

    def add_arguments(self, parser):
        parser.add_argument(
            '--destroy',
            action='store_true',
            dest='destroy',
            default=False,
            help='Delete all collections, assets, and tasks for user'
        )
        parser.add_argument(
            '--destination',
            action='store',
            dest='destination',
            default=False,
            help='A uid of a destination collection that will contain the imported asset(s)'
        )
        parser.add_argument(
            '--username',
            action='store',
            dest='username',
            default=False,
            help='Delete all collections for user'
        )

    def handle(self, *args, **options):
        if not options.get('username'):
            raise Exception("username flag required '--username'")
        user = User.objects.get(username=options.get('username'))
        destination = options.get('destination', False)
        if destination:
            parent_coll = user.assets.filter(
                asset_type=ASSET_TYPE_COLLECTION
            ).get(uid=destination)  # .children().all()
            destination_collection = user.assets.filter(
                asset_type=ASSET_TYPE_COLLECTION
            ).filter(parent=parent_coll)
        else:
            destination_collection = user.assets.filter(
                asset_type=ASSET_TYPE_COLLECTION
            )

        if options.get('destroy'):
            destination_collection.all().delete()
            ImportTask.objects.filter(user=user).delete()
        url = args[0]
        import_task = ImportTask.objects.create(
            user=user,
            data={
                'url': url,
                'destination': destination
            })
        import_task.run()
