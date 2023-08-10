from django.core.management.commands import makemessages


class Command(makemessages.Command):

    xgettext_options = makemessages.Command.xgettext_options + [
        '--keyword=t',
        '--keyword=nt',
    ]

    def handle(self, *args, **options):
        options['ignore_patterns'].append('node_modules*')
        options['ignore_patterns'].append('jsapp/compiled*')
        options['ignore_patterns'].append('staticfiles*')
        if options['domain'] == 'djangojs':
            options['extensions'] = ['js', 'tsx', 'ts', 'es6']

        super().handle(*args, **options)
