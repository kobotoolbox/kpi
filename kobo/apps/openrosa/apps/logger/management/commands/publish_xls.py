# coding: utf-8
import os

from django.core.management.base import BaseCommand, CommandError
from pyxform.builder import create_survey_from_xls

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models.xform import XForm
from kobo.apps.openrosa.libs.utils.logger_tools import publish_xls_form
from kobo.apps.openrosa.libs.utils.viewer_tools import django_file


class Command(BaseCommand):
    args = 'xls_file username'
    help = ("Publish an XLS file with the option of replacing an"
            "existing one")

    def add_arguments(self, parser):
        parser.add_argument('xls_filepath',
                            help="Path to the xls file")

        parser.add_argument('username',
                            help="Username to publish the form to")

        parser.add_argument('-r', '--replace',
                            action='store_true',
                            dest='replace',
                            help="Replace existing form if any")

    def handle(self, *args, **options):
        try:
            xls_filepath = options['xls_filepath']
        except KeyError:
            raise CommandError("You must provide the path to the xls file.")
        # make sure path exists
        if not xls_filepath or not os.path.exists(xls_filepath):
            raise CommandError(
                "The xls file '%s' does not exist." %
                xls_filepath)

        try:
            username = options['username']
        except KeyError:
            raise CommandError(
                "You must provide the username to publish the form to.")
        # make sure user exists
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            raise CommandError("The user '%s' does not exist." % username)

        # wasteful but we need to get the id_string beforehand
        survey = create_survey_from_xls(xls_filepath)

        # check if a form with this id_string exists for this user
        form_already_exists = XForm.objects.filter(
            user=user, id_string=survey.id_string).count() > 0

        # id_string of form to replace, if any
        id_string = None
        if form_already_exists:
            if 'replace' in options and options['replace']:
                id_string = survey.id_string
                self.stdout.write("Form already exist, replacing ..\n")
            else:
                raise CommandError(
                    "The form with id_string '%s' already exists, use the -r "
                    "option to replace it." % survey.id_string)
        else:
            self.stdout.write("Form does NOT exist, publishing ..\n")

        # publish
        xls_file = django_file(
            xls_filepath, 'xls_file', 'application/vnd.ms-excel')
        publish_xls_form(xls_file, user, id_string)
        self.stdout.write("Done..\n")
