# coding: utf-8
import os

import subprocess
import atexit
import signal

from django.conf import settings
from django.contrib.staticfiles.management.commands.runserver import Command\
    as StaticfilesRunserverCommand


class Command(StaticfilesRunserverCommand):
    # As described in this blog post:
    # http://lincolnloop.com/blog/simplifying-your-django-frontend-tasks-grunt/

    def handle(self, *args, **kwargs):
        messages = []
        if not settings.DEBUG:
            messages.append("You cannot have `settings.DEBUG = False` when "
                            "trying to run the 'gruntserver' management command")
        return super().handle(*args, **kwargs)

    def inner_run(self, *args, **options):
        self.start_grunt()
        return super().inner_run(*args, **options)

    def start_grunt(self):
        self.stdout.write('>>> Starting grunt')
        self.grunt_process = subprocess.Popen(
            ['grunt --gruntfile={0}/Gruntfile.js --base=.'.format(settings.BASE_DIR)],
            shell=True,
            stdin=subprocess.PIPE,
            stdout=self.stdout,
            stderr=self.stderr,
        )

        self.stdout.write('>>> Grunt process on pid {0}'.format(self.grunt_process.pid))

        def kill_grunt_process(pid):
            self.stdout.write('>>> Closing grunt process')
            os.kill(pid, signal.SIGTERM)

        atexit.register(kill_grunt_process, self.grunt_process.pid)
