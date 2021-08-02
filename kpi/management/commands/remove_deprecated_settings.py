# coding: utf-8
import copy
import json
from contextlib import contextmanager

from django.core.management.base import BaseCommand

from kpi.models import Asset


@contextmanager
def _disable_auto_field_update(kls, field_names):
    AUTO_ATTRS = ('auto_now', 'auto_now_add')
    previous_values = {}
    for field_name in field_names:
        field = [f for f in kls._meta.fields if f.name == field_name][0]
        for attr in AUTO_ATTRS:
            previous_values[field_name] = previous_values.get(field_name, {})
            previous_values[field_name][attr] = getattr(field, attr)
            # Turn it off!
            setattr(field, attr, False)
    yield
    # Restore the previous values
    for field_name in field_names:
        for attr in AUTO_ATTRS:
            setattr(field, attr, previous_values[field_name][attr])


class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument(
            '--dryrun',
            action='store_true',
            dest='dryrun',
            default=False,
            help='Print what would be done, but do not make any changes'
        )

    def handle(self, *args, **options):
        commit_changes = not options.get('dryrun')
        # prevent timestamps from updating
        with _disable_auto_field_update(
                Asset, ('date_created', 'date_modified')):
            for asset in Asset.objects.all():
                # settingslist
                if len(asset.content.get('settings', [])) > 0:
                    changed = False
                    settings = asset.content['settings'][0]
                    old_settings = copy.copy(settings)
                    if 'form_id' in settings:
                        if settings['form_id'] != 'new_form':
                            settings['id_string'] = settings['form_id']
                        del settings['form_id']
                        changed = True
                    if 'form_title' in settings and \
                            settings['form_title'] == 'New form':
                        del settings['form_title']
                        changed = True
                    if changed:
                        if commit_changes:
                            try:
                                asset.content['settings'] = [settings]
                                asset.save()
                            except Exception as err:
                                print('Error running migration:')
                                print(str(err))
                                import pdb
                                pdb.set_trace()
                        else:
                            print('settings changed on asset %s: ' % asset.uid)
                            print('  ' + json.dumps(old_settings))
                            print('  ' + json.dumps(settings))
