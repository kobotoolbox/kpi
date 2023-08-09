from django.core.management.commands import makemessages


class Command(makemessages.Command):

    xgettext_options = makemessages.Command.xgettext_options + [
        '--keyword=t',
        '--keyword=nt',
    ]

    def handle(self, *args, **options):
        options['ignore_patterns'].append('node_modules*')
        super().handle(*args, **options)
