# coding: utf-8
import time
from django.core.management.base import BaseCommand
from django.db import connections
from django.db.models import Func, F, Value
from kobo.apps.openrosa.apps.logger.models import XForm, Instance


def replace_first_and_last(s, old, new):
    s = s.replace(old, new, 1)
    # credit: http://stackoverflow.com/a/2556252
    return new.join(s.rsplit(old, 1))


def write_same_line(dest_file, output, last_len=[0]):
    dest_file.write('\r{}'.format(output), ending='')
    this_len = len(output)
    too_short = last_len[0] - this_len
    last_len[0] = this_len
    if too_short > 0:
        dest_file.write(' ' * too_short, ending='')
    dest_file.flush()


XFORM_ROOT_NODE_NAME_PATTERN = r'<instance>[^<]*< *([^ ]+)'
INSTANCE_ROOT_NODE_NAME_PATTERN = r'\/ *([^\/> ]+) *>[^<>]*$'


class Command(BaseCommand):
    """
    This command cleans up inconsistences between the root instance node
    name specified in the form XML and the actual instance XML. Where a
    discrepancy exists, the instance will be changed to match the form.
    The cause of these mismatches is documented at
    https://github.com/kobotoolbox/kobocat/issues/222 and
    https://github.com/kobotoolbox/kobocat/issues/358. See also
    https://github.com/kobotoolbox/kobocat/issues/242.
    """

    help = 'fixes instances whose root node names do not match their forms'

    def add_arguments(self, parser):
        parser.add_argument(
            '--minimum-instance-pk',
            type=int,
            dest='pk__gte',
            help='consider only instances whose ID is greater than or equal '\
                 'to this number'
        )
        parser.add_argument(
            '--form-id-string',
            dest='xform__id_string',
            help='consider only forms matching this `id_string`. combine '\
                 'with --username to ensure an exact match'
        )
        parser.add_argument(
            '--username',
            dest='xform__user__username',
            help='consider only forms belonging to a particular user'
        )
        parser.add_argument(
            '--instance-xml-search-string',
            dest='xml__contains',
            help='consider only instances whose XML contains this string'\
        )

    def handle(self, *args, **options):
        verbosity = options['verbosity']
        if len(list(connections)) > 1:
            raise NotImplementedError(
                "This management command does not support multiple-database "
                "configurations"
            )
        connection = connections['default']
        if connection.Database.__name__ != 'psycopg2':
            raise NotImplementedError(
                "Only the `psycopg2` database backend is supported")

        instances = Instance.objects.all().order_by('pk')
        xforms = XForm.objects.all()
        for option in (
                'pk__gte',
                'xform__id_string',
                'xform__user__username',
                'xml__contains'
        ):
            if options[option]:
                instances = instances.filter(**{option: options[option]})
                if option.startswith('xform__'):
                    xforms = xforms.filter(
                        **{option[len('xform__'):]: options[option]}
                    )

        instances = instances.annotate(
            root_node_name=Func(
                F('xml'),
                Value(INSTANCE_ROOT_NODE_NAME_PATTERN),
                function='regexp_matches'
            )
        ).values_list('pk', 'xform_id', 'root_node_name')
        if not instances.exists():
            self.stderr.write('No Instances found.')
            return
        t0 = time.time()
        self.stderr.write(
            'Fetching Instances; please allow several minutes...', ending='')
        instances = list(instances)
        self.stderr.write(
            'got {} in {} seconds.'.format(
                len(instances),
                int(time.time() - t0)
            )
        )

        # Getting the XForm root node names separately is far more efficient
        # than calling `regexp_matches` on `xform__xml` in the `Instance` query
        xforms = xforms.annotate(
            root_node_name=Func(
                F('xml'),
                Value(XFORM_ROOT_NODE_NAME_PATTERN),
                function='regexp_matches'
           )
        ).values_list('pk', 'root_node_name')
        self.stderr.write('Fetching XForm root node names...', ending='')
        t0 = time.time()
        xform_root_node_names = dict(xforms)
        self.stderr.write(
            'got {} in {} seconds.'.format(
                len(xform_root_node_names),
                int(time.time() - t0)
            )
        )

        completed_instances = 0
        changed_instances = 0
        failed_instances = 0
        progress_interval = 1 # second
        t0 = time.time()
        t_last = t0

        self.stdout.write(
            'Instance\tXForm\tOld Root Node Name\tNew Root Node Name')
        for instance in instances:
            t_now = time.time()
            if (verbosity > 1 and t_now - t_last >= progress_interval
                    and completed_instances):
                t_last = t_now
                t_elapsed = t_now - t0
                write_same_line(
                    self.stderr,
                    'Completed {} Instances: {} changed, {} failed; '
                    '{}s elapsed, {} Instance/sec.'.format(
                        completed_instances,
                        changed_instances,
                        failed_instances,
                        int(t_elapsed),
                        int(completed_instances / t_elapsed)
                    )
                )

            instance_id = instance[0]
            xform_id = instance[1]
            # `regexp_matches` results come back as `list`s from the ORM
            instance_root_node_name = instance[2]
            xform_root_node_name = xform_root_node_names[xform_id]
            if not len(instance_root_node_name) == 1:
                self.stderr.write(
                    '!!! Failed to get root node name for Instance {}'.format(
                        instance_id)
                )
                failed_instances += 1
                completed_instances += 1
                continue
            if not len(xform_root_node_name) == 1:
                self.stderr.write(
                    '!!! Failed to get root node name for XForm {}'.format(
                        xform_id)
                )
                failed_instances += 1
                completed_instances += 1
                continue

            instance_root_node_name = instance_root_node_name[0]
            xform_root_node_name = xform_root_node_name[0]
            if instance_root_node_name == xform_root_node_name:
                completed_instances += 1
                continue

            queryset = Instance.objects.filter(pk=instance_id).only('xml')
            fixed_xml = replace_first_and_last(
                queryset[0].xml, instance_root_node_name, xform_root_node_name)
            new_xml_hash = Instance.get_hash(fixed_xml)
            queryset.update(xml=fixed_xml, xml_hash=new_xml_hash)
            self.stdout.write('{}\t{}\t{}\t{}'.format(
                instance_id, xform_id,
                instance_root_node_name, xform_root_node_name
            ))
            changed_instances += 1
            completed_instances += 1

        self.stderr.write(
            '\nFinished {} Instances: {} changed, {} failed.'.format(
                completed_instances,
                changed_instances,
                failed_instances
            )
        )
        self.stdout.write(
            'At the start of processing, the last instance PK '
            'was {}.'.format(instance_id)
        )
