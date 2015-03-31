from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User
from kpi.models import Collection
from kpi.models import SurveyAsset
from kpi.models import ImportTask
# from pyxform.xls2json_backends import csv_to_dict
from optparse import make_option

class Command(BaseCommand):
    option_list = BaseCommand.option_list + (
        make_option('--destroy',
            action='store_true',
            dest='destroy',
            default=False,
            help='Delete all collections, assets, and tasks for user'),
        make_option('--username',
            action='store',
            dest='username',
            default=False,
            help='Delete all collections for user'),
        )

    def handle(self, *args, **options):
        if not options.get('username'):
            raise Exception("username flag required '--username'")
        user = User.objects.get(username=options.get('username'))
        if options.get('destroy'):
            user.owned_collections.all().delete()
            user.survey_assets.all().delete()
            ImportTask.objects.filter(user=user).delete()
        url = args[0]
        import_task = ImportTask.objects.create(user=user,
            data={
                'url': args[0]
            })
        import_task.run()
