import copy
import json
from django.core.management.base import BaseCommand

from kpi.models import Asset


def _set_auto_field_update(kls, field_name, val):
    field = filter(lambda f: f.name == field_name, kls._meta.fields)[0]
    field.auto_now = val
    field.auto_now_add = val


class Command(BaseCommand):
    def handle(self, *args, **options):
        if len(args) > 0 and args[0] == 'dryrun':
            commit_changes = False
        else:
            commit_changes = True

        # prevent timestamps from updating
        _set_auto_field_update(Asset, "date_created", True)
        _set_auto_field_update(Asset, "date_modified", True)

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
                            print(err.message)
                            import pdb
                            pdb.set_trace()
                    else:
                        print('settings changed on asset %s: ' % asset.uid)
                        print('  ' + json.dumps(old_settings))
                        print('  ' + json.dumps(settings))

        _set_auto_field_update(Asset, "date_created", False)
        _set_auto_field_update(Asset, "date_modified", False)
