from django.core.management.base import BaseCommand, CommandError
from drf_spectacular.renderers import OpenApiJsonRenderer, OpenApiYamlRenderer

from kpi.utils.spectacular_processing import OpenRosaSchemaGenerator, V2SchemaGenerator


SCHEMA_GENERATORS = {
    'openrosa': OpenRosaSchemaGenerator,
    'api_v2': V2SchemaGenerator,
}

FORMAT_RENDERERS = {
    'openapi-json': OpenApiJsonRenderer,
    'openapi': OpenApiYamlRenderer,
}


class Command(BaseCommand):
    help = 'Generate OpenAPI schema using a specific generator (api_v2, openrosa)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--schema',
            choices=SCHEMA_GENERATORS.keys(),
            required=True,
            help='Which schema to generate (e.g. "api_v2", "openrosa")'
        )
        parser.add_argument(
            '--format',
            choices=FORMAT_RENDERERS.keys(),
            default='openapi',
            help='Output format: openapi (default) or openapi-json'
        )
        parser.add_argument(
            '--file',
            type=str,
            help='Output file (default: stdout)',
        )

    def handle(self, *args, **options):
        schema_name = options['schema']
        output_format = options['format']
        output_file = options.get('file')

        generator_class = SCHEMA_GENERATORS.get(schema_name)
        if not generator_class:
            raise CommandError(f'Unsupported schema: {schema_name}')

        renderer_class = FORMAT_RENDERERS.get(output_format)
        if not renderer_class:
            raise CommandError(f'Unsupported format: {output_format}')

        api_version = '' if schema_name == 'openrosa' else schema_name
        generator = generator_class(api_version=api_version)
        schema = generator.get_schema(request=None, public=True)
        rendered = renderer_class().render(schema, renderer_context={})

        if output_file:
            mode = 'wb' if isinstance(rendered, bytes) else 'w'
            with open(output_file, mode) as f:
                f.write(rendered)
            self.stdout.write(
                f'✅ {schema_name}-{output_format} schema written to {output_file}'
            )
        else:
            # fallback to stdout
            output = (
                rendered.decode('utf-8')
                if isinstance(rendered, bytes)
                else rendered
            )
            self.stdout.write(output)
