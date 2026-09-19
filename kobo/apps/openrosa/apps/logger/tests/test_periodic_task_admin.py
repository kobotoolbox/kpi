from unittest.mock import patch

from django.contrib.admin.sites import AdminSite
from django.contrib.messages import ERROR, WARNING
from django.test import RequestFactory, TestCase
from django_celery_beat.models import IntervalSchedule, PeriodicTask
from kombu.utils.json import dumps, loads

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.admin import PeriodicTaskAdmin
from kpi.models.asset import Asset

TASK_PATH = 'kobo.apps.openrosa.apps.logger.tasks.restore_soft_deleted_attachments'


class RunTasksActionTestCase(TestCase):
    """
    What "Run selected tasks" does to a job support points at a project.
    """

    def setUp(self):
        self.admin = PeriodicTaskAdmin(PeriodicTask, AdminSite())
        self.user = User.objects.create(username='support', email='support@example.com')

        self.asset = Asset.objects.create(
            owner=self.user,
            content={'survey': [{'type': 'text', 'name': 'q1', 'label': ['Q1']}]},
        )
        self.asset.deploy(backend='mock', active=True)

        self.schedule, _ = IntervalSchedule.objects.get_or_create(
            every=1, period='days'
        )

    def test_the_launcher_is_told_the_project_does_not_exist(self):
        periodic_task = self._periodic_task({'asset_uid': 'aNoSuchAsset'})

        response, messages = self._run([periodic_task])

        assert messages == [
            (
                '"Restore attachments" was not run:'
                ' Asset `aNoSuchAsset` does not exist',
                ERROR,
            )
        ]

    def test_the_launcher_is_told_the_keyword_arguments_are_empty(self):
        periodic_task = self._periodic_task({'asset_uid': ''})

        response, messages = self._run([periodic_task])

        assert len(messages) == 1
        assert 'no `asset_uid` is set' in messages[0][0]
        assert messages[0][1] == ERROR

    def test_the_log_goes_to_whoever_hit_the_button(self):
        periodic_task = self._periodic_task({'asset_uid': self.asset.uid})

        with patch.object(PeriodicTaskAdmin.__bases__[0], 'run_tasks') as run_tasks:
            self._run([periodic_task])

        launched = run_tasks.call_args[0][1]
        assert loads(launched[0].kwargs)['email_to'] == 'support@example.com'

        # The row itself is untouched: storing the address would mail it on
        # every later run, and would make Beat reload its whole schedule
        periodic_task.refresh_from_db()
        assert 'email_to' not in loads(periodic_task.kwargs)

    def test_an_address_filled_in_on_purpose_wins(self):
        periodic_task = self._periodic_task(
            {'asset_uid': self.asset.uid, 'email_to': 'someone@example.com'}
        )

        with patch.object(PeriodicTaskAdmin.__bases__[0], 'run_tasks') as run_tasks:
            self._run([periodic_task])

        launched = run_tasks.call_args[0][1]
        assert loads(launched[0].kwargs)['email_to'] == 'someone@example.com'

    def test_an_unrelated_task_is_neither_checked_nor_touched(self):
        periodic_task = PeriodicTask.objects.create(
            name='Something else',
            task='kobo.apps.openrosa.apps.logger.tasks.delete_daily_counters',
            interval=self.schedule,
            enabled=False,
            kwargs=dumps({}),
        )

        with patch.object(PeriodicTaskAdmin.__bases__[0], 'run_tasks') as run_tasks:
            self._run([periodic_task])

        launched = run_tasks.call_args[0][1]
        assert loads(launched[0].kwargs) == {}

    def test_the_project_is_shown_before_anything_is_queued(self):
        """
        One row is shared by everyone, so the arguments read at click time are
        whoever saved last, not what this person had on screen. They get to see
        the project first.
        """

        periodic_task = self._periodic_task({'asset_uid': self.asset.uid})

        with patch.object(PeriodicTaskAdmin.__bases__[0], 'run_tasks') as run_tasks:
            response, _ = self._run([periodic_task], confirmed=False)

        run_tasks.assert_not_called()
        response.render()
        assert self.asset.uid in response.content.decode()

    def test_a_row_saved_after_it_was_confirmed_is_shown_again(self):
        """
        The confirmation page sends back the arguments it showed. When somebody
        saved the row in between, running what the database now holds would
        run what nobody confirmed.
        """

        periodic_task = self._periodic_task({'asset_uid': self.asset.uid})
        shown = periodic_task.kwargs
        periodic_task.kwargs = dumps({'asset_uid': self.asset.uid, 'dry_run': False})
        periodic_task.save()

        with patch.object(PeriodicTaskAdmin.__bases__[0], 'run_tasks') as run_tasks:
            response, messages = self._run(
                [periodic_task], confirmed_kwargs={periodic_task.pk: shown}
            )

        run_tasks.assert_not_called()
        assert len(messages) == 1
        assert 'was changed after you confirmed it' in messages[0][0]
        assert messages[0][1] == WARNING

        # What is shown again is what the row holds now, ready to be confirmed
        response.render()
        content = response.content.decode()
        assert 'this run will write' in content
        assert f'name="confirmed_kwargs_{periodic_task.pk}"' in content

    def test_a_confirmation_that_sends_nothing_back_is_shown_again(self):
        periodic_task = self._periodic_task({'asset_uid': self.asset.uid})

        with patch.object(PeriodicTaskAdmin.__bases__[0], 'run_tasks') as run_tasks:
            response, _ = self._run([periodic_task], confirmed_kwargs={})

        run_tasks.assert_not_called()
        assert response is not None

    def _periodic_task(self, kwargs: dict) -> PeriodicTask:
        return PeriodicTask.objects.create(
            name='Restore attachments',
            task=TASK_PATH,
            interval=self.schedule,
            enabled=False,
            kwargs=dumps(kwargs),
        )

    def _run(
        self,
        periodic_tasks: list,
        confirmed: bool = True,
        confirmed_kwargs: dict = None,
    ) -> tuple:
        """
        Run the action and collect what it told the person, `message_user()`
        needing a message store the bare `RequestFactory` does not give.

        `confirmed` skips the interstitial page, which is what a second POST
        does once the person has seen which project is about to be worked on.
        That POST sends back the arguments the page showed, by default what
        each row holds, unless `confirmed_kwargs` says otherwise per `pk`.
        """

        data = {}
        if confirmed:
            if confirmed_kwargs is None:
                confirmed_kwargs = {task.pk: task.kwargs for task in periodic_tasks}
            data['run_confirmed'] = 'yes'
            for pk, kwargs in confirmed_kwargs.items():
                data[f'confirmed_kwargs_{pk}'] = kwargs
        request = RequestFactory().post('/admin/', data)
        request.user = self.user
        messages = []

        with patch.object(
            PeriodicTaskAdmin,
            'message_user',
            side_effect=lambda req, message, level=None, **kw: messages.append(
                (message, level)
            ),
        ):
            response = self.admin.run_tasks(
                request,
                PeriodicTask.objects.filter(
                    pk__in=[task.pk for task in periodic_tasks]
                ),
            )

        return response, messages
