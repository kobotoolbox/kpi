# coding: utf-8
from allauth.account.models import EmailAddress
from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import connection

from kobo.apps.kobo_auth.shortcuts import User
from kpi.models import Asset


class Command(BaseCommand):
    """
    Mostly copied from django/core/management/commands/testserver.py, except
    for `insert_test_data()`
    """

    help = 'Runs a development server with data to facilitate Cypress testing.'

    requires_system_checks = []

    def add_arguments(self, parser):
        parser.add_argument(
            'args', metavar='fixture', nargs='*',
            help='Path(s) to fixtures to load before running the server.',
        )
        parser.add_argument(
            '--noinput', '--no-input', action='store_false', dest='interactive',
            help='Tells Django to NOT prompt the user for input of any kind.',
        )
        parser.add_argument(
            '--addrport', default='',
            help='Port number or ipaddr:port to run the server on.',
        )
        parser.add_argument(
            '--ipv6', '-6', action='store_true', dest='use_ipv6',
            help='Tells Django to use an IPv6 address.',
        )

    def handle(self, *fixture_labels, **options):
        if not settings.TESTING:
            raise CommandError(
                'Please run this command with appropriate test settings, e.g. '
                'by specifying `DJANGO_SETTINGS_MODULE=kobo.settings.testing`.'
            )

        verbosity = options['verbosity']
        interactive = options['interactive']

        # Create a test database.
        db_name = connection.creation.create_test_db(
            verbosity=verbosity, autoclobber=not interactive, serialize=False
        )

        if fixture_labels:
            # Optionally import any fixtures specified on the command line into
            # the database.
            call_command('loaddata', *fixture_labels, **{'verbosity': verbosity})
        else:
            # Load the `test_data` fixture by default
            call_command('loaddata', ['test_data'], **{'verbosity': verbosity})

        # Insert fixture data that are written here as Python code
        self.insert_test_data()

        # Run the development server. Turn off auto-reloading because it causes
        # a strange error -- it causes this handle() method to be called
        # multiple times.
        shutdown_message = (
            '\nServer stopped.\nNote that the test database, %r, has not been '
            'deleted. You can explore it on your own.' % db_name
        )
        use_threading = connection.features.test_db_allows_multiple_connections
        call_command(
            'runserver',
            addrport=options['addrport'],
            shutdown_message=shutdown_message,
            use_reloader=False,
            use_ipv6=options['use_ipv6'],
            use_threading=use_threading
        )

    @classmethod
    def insert_test_data(cls):
        """
        Intended to provide for the following scenarios:

        | USERNAME/PASSWORD  | DONE? | STATE NEEDED                                       |
        | ------------------ | ----- | -------------------------------------------------- |
        | project_creator    | Yes   | Empty                                              |
        | question_creator   | Yes   | Has a project with no questions.                   |
        | project_deleter    | Yes   | Has a deployed project.                            |
        | question_deleter   | Yes   | Has a project that has a question.                 |
        | template_creator   | Yes   | Has a project with questions.                      |
        | template_cloner    | Yes   | Has a template                                     |
        | project_replacer   | Yes   | Has a project and a template with different names. |
        | rest_creator       | Yes   | Has a deployed project.                            |
        | rest_editor        | No    | Has a deployed project with a REST service added.  |
        | rest_deleter       | No    | Has a deployed project with a REST service added.  |
        | submission_counter | No    | Has a deployed project with a REST service added.  |
        | submission_retryer | No    | Has a deployed project with a REST service added.  |
        """

        # Create several users, making the usernames and passwords identical
        users = [
            'project_creator',
            'question_creator',
            'project_deleter',
            'question_deleter',
            'template_creator',
            'template_cloner',
            'project_replacer',
            'rest_creator',
            'rest_editor',
            'rest_deleter',
            'submission_counter',
            'submission_retryer',
        ]
        for user in users:
            email = f'{user}@fake.kbtdev.org'
            user_obj = User(username=user, email=email)
            user_obj.set_password(user)
            user_obj.save()
            EmailAddress.objects.create(
                user=user_obj, email=email, verified=True, primary=True
            )

        # Create an "empty" survey with no questions other than the defaults
        # added by the form builder
        empty_survey = Asset.objects.create(
            owner=User.objects.get(username='question_creator'),
            uid='awYwRjwWqfZU66hQrUPu6p',
            asset_type='survey',
            name='Vegetables',
            content={
                'schema': '1',
                'survey': [
                    {
                        'name': 'start',
                        'type': 'start',
                        '$kuid': 'EasI1uyRI',
                        '$autoname': 'start',
                    },
                    {
                        'name': 'end',
                        'type': 'end',
                        '$kuid': 'OryDCqVWN',
                        '$autoname': 'end',
                    },
                ],
                'settings': {},
            },
            settings={
                'sector': {
                    'label': 'Humanitarian - Food Security',
                    'value': 'Humanitarian - Food Security',
                },
                'country': [{'label': 'United States', 'value': 'USA'}],
                'description': 'A survey about vegetables',
                'share-metadata': True,
            },
        )

        # Create a survey and deploy it
        deployed_survey_to_delete = Asset.objects.create(
            owner=User.objects.get(username='project_deleter'),
            uid='awc4zsdhZQFbu3pa4Fpfmp',
            asset_type='survey',
            name="I'm doomed",
            content={
                'schema': '1',
                'survey': [
                    {
                        'name': 'start',
                        'type': 'start',
                        '$kuid': 'uYwIS8ehw',
                        '$autoname': 'start',
                    },
                    {
                        'name': 'end',
                        'type': 'end',
                        '$kuid': 'qlCvqrKK0',
                        '$autoname': 'end',
                    },
                    {
                        'type': 'select_one',
                        '$kuid': 'zo6wy80',
                        'label': ['Will this submission be trashed?'],
                        'required': False,
                        '$autoname': 'Will_this_submission_be_trashed',
                        'select_from_list_name': 'hz66l14',
                    },
                ],
                'choices': [
                    {
                        'name': 'yes',
                        '$kuid': 'TSlvl39ox',
                        'label': ['Yes'],
                        'list_name': 'hz66l14',
                        '$autovalue': 'yes',
                    },
                    {
                        'name': 'definitely',
                        '$kuid': 'ISmIeoamt',
                        'label': ['Definitely'],
                        'list_name': 'hz66l14',
                        '$autovalue': 'definitely',
                    },
                ],
                'settings': {},
                'translated': ['label'],
                'translations': [None],
            },
            settings={
                'sector': None,
                'country': None,
                'description': 'This project will be deleted',
                'share-metadata': False,
            },
        )
        deployed_survey_to_delete.deploy(backend='mock')
        # Add a submission
        cls.submit_to_asset_with_mock_deployment(
            asset=deployed_survey_to_delete,
            submissions=[
                {
                    'start': '2022-03-25T22:13:49.535-04:00',
                    'end': '2022-03-25T22:13:51.741-04:00',
                    'Will_this_submission_be_trashed': 'yes',
                    'meta/instanceID': 'uuid:c9b38e0d-8ef3-420c-86c2-d0594d762244',
                }
            ],
        )

        # Create a survey with one question
        survey_with_question = Asset.objects.create(
            owner=User.objects.get(username='question_deleter'),
            uid='aqqKvrQQigM8xEzHyPncGr',
            asset_type='survey',
            name='Vegetables',
            content={
                'schema': '1',
                'survey': [
                    {
                        'name': 'start',
                        'type': 'start',
                        '$kuid': 'EmyqrXLkp',
                        '$autoname': 'start',
                    },
                    {
                        'name': 'end',
                        'type': 'end',
                        '$kuid': 'Z5pfOnpXr',
                        '$autoname': 'end',
                    },
                    {
                        'type': 'integer',
                        '$kuid': 'ov2ro58',
                        'label': [
                            'How many blocks do you have to walk to buy fresh vegetables?'
                        ],
                        'required': False,
                        '$autoname': 'How_many_blocks_do_y_buy_fresh_vegetables',
                    },
                ],
                'settings': {},
                'translated': ['label'],
                'translations': [None],
            },
            settings={
                'sector': {
                    'label': 'Humanitarian - Food Security',
                    'value': 'Humanitarian - Food Security',
                },
                'country': [{'label': 'United States', 'value': 'USA'}],
                'description': 'A survey about vegetables',
            },
        )

        # Copy the survey with one question to the `template_creator` account
        survey_with_question_for_template_creator = Asset.objects.create(
            owner=User.objects.get(username='template_creator'),
            uid='a5JsBb8gJJRtriAjtcrQB9',
            asset_type='survey',
            name='Vegetables',
            content=survey_with_question.content.copy(),
            settings=survey_with_question.settings.copy(),
        )

        # Copy the survey with one question to a template owned by the
        # `template_cloner` account
        template = Asset.objects.create(
            owner=User.objects.get(username='template_cloner'),
            uid='aDPejCn9RBMwaNq4wpw4cU',
            asset_type='template',
            name='Vegetables (template)',
            content=survey_with_question.content.copy(),
            settings=survey_with_question.settings.copy(),
        )

        # Copy the survey with one question to the `project_replacer` account
        survey_with_question_for_template_creator = Asset.objects.create(
            owner=User.objects.get(username='project_replacer'),
            uid='ahsD35WsPhATu7PhTCTqsV',
            asset_type='survey',
            name='Vegetables (survey)',
            content=survey_with_question.content.copy(),
            settings=survey_with_question.settings.copy(),
        )

        # Add another template that has a second question
        template_with_two_questions = Asset.objects.create(
            owner=User.objects.get(username='project_replacer'),
            uid='aeLnt9uAHhgQTg7FVVfcoU',
            asset_type='template',
            name='Vegetables (template)',
            content={
                'schema': '1',
                'survey': [
                    {
                        'name': 'start',
                        'type': 'start',
                        '$kuid': '6TP7NAtB5',
                        '$autoname': 'start',
                    },
                    {
                        'name': 'end',
                        'type': 'end',
                        '$kuid': '2obDi0dN9',
                        '$autoname': 'end',
                    },
                    {
                        'type': 'integer',
                        '$kuid': 'ov2ro58',
                        'label': [
                            'How many blocks do you have to walk to buy fresh vegetables?'
                        ],
                        'required': False,
                        '$autoname': 'How_many_blocks_do_y_buy_fresh_vegetables',
                    },
                    {
                        'type': 'range',
                        '$kuid': 'qb5xc56',
                        'label': [
                            'How would you rate the quality of the fresh vegetables available at this market?'
                        ],
                        'required': False,
                        '$autoname': 'How_would_you_rate_t_lable_at_this_market',
                        'appearance': 'rating',
                        'parameters': 'start=1;end=5;step=1',
                    },
                ],
                'settings': {},
            },
            settings={
                'sector': {
                    'label': 'Humanitarian - Food Security',
                    'value': 'Humanitarian - Food Security',
                },
                'country': [{'label': 'United States', 'value': 'USA'}],
                'description': 'A survey about vegetables',
            },
        )

        # Create a survey using the content from `template_with_two_questions`
        # and deploy it for testing REST Services
        deployed_survey = Asset.objects.create(
            owner=User.objects.get(username='rest_creator'),
            uid='ao5rXn29HKhhp4rgXWNe8i',
            asset_type='survey',
            name='Vegetables (template)',
            content=template_with_two_questions.content.copy(),
            settings=template_with_two_questions.settings.copy(),
        )
        deployed_survey.deploy(backend='mock')

    @staticmethod
    def submit_to_asset_with_mock_deployment(asset, submissions):
        latest_version_uuid = asset.latest_deployed_version.uid
        def set_version(submission):
            submission['__version__'] = latest_version_uuid
            return submission
        submission_generator = (set_version(s) for s in submissions)
        asset.deployment.mock_submissions(submission_generator)
