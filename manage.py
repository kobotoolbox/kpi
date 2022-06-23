#!/usr/bin/env python
import os
import sys
import ptvsd

if __name__ == "__main__":
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "kobo.settings.prod")

    from django.core.management import execute_from_command_line
    if os.environ.get('RUN_MAIN') or os.environ.get('WERKZEUG_RUN_MAIN'):
        ptvsd.enable_attach(address = ('0.0.0.0', 5678))

    execute_from_command_line(sys.argv)
