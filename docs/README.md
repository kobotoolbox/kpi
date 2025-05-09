# DRF-Spectacular API Integration for KPI

### Introduction

[drf-spectacular](https://drf-spectacular.readthedocs.io/) is an OpenAPI 3 schema
generator designed specifically for Django REST Framework (DRF). It inspects DRF’s views,
serializers, fields, and routing logic to automatically generate a compliant OpenAPI
schema. This schema is exposed at endpoints like `/api/v2/schema/` and rendered visually
using Swagger UI at `/api/v2/docs/`

DRF-Spectacular integrates seamlessly with standard DRF components like APIView, ViewSet,
Serializer, and custom actions. It supports detailed annotations via decorators such
as `@extend_schema` and `@extend_schema_view`, allowing developers to fine-tune the schema
when automatic inference is not enough.

The KPI API integration with drf-spectacular involves many subtle details that may be
confusing at first glance. Several custom features were implemented to ensure the API is
correctly documented and user-friendly. This document explains the most important
customizations used in our codebase.

---

## Schema Auto-Detection

By default, **drf-spectacular** uses the `serializer_class` attribute—or the
`get_serializer_class()` method—of a `ViewSet` to automatically detect the schema for an
endpoint. If this attribute is missing, or if the method returns different serializers
dynamically based on context (e.g., `self.action`, HTTP method, or request parameters),
**drf-spectacular** may not be able to infer the correct schema automatically.

Additionally, not all field types are natively supported. For example, fields like
`SerializerMethodField()` do not expose their output type, and will appear as `string`
by default in the generated schema.

In these cases, it's necessary to explicitly annotate views using the decorators mentioned
earlier (`@extend_schema`, `@extend_schema_view`) to provide custom schema definitions for
requests and responses.

---

## @extend\_schema

The `@extend_schema` decorator is used to enrich individual view methods or custom
actions with additional metadata for documentation purposes. It allows you to manually
specify details that cannot be inferred automatically, such as:

- `tags`: to categorize and group endpoints
- `description`: to provide contextual help or usage notes
- `request`: to declare the expected input format
- `responses`: to define one or multiple possible response schemas

Example:

```python
@extend_schema(
    tags=['My-Category'],
    description='Returns a list of my objects.',
    request=None,
    responses={200: OpenApiResponse(CategoryInlineSerializer)},
)
```

This is especially useful for custom actions or views that use `SerializerMethodField`,
dynamic serializers, or skip request bodies.

---

## @extend\_schema\_view

The `@extend_schema_view` decorator allows you to annotate standard `ViewSet` methods like
`list`, `create`, `retrieve`, `update`, or `destroy` in a grouped way. It is helpful when
you want to document multiple methods within a `ViewSet` without repeating
`@extend_schema` on each one.

It is also useful when your `ViewSet class relies on DRF’s default method implementations
(e.g., `list`) and you don’t want to override them just to attach schema metadata.
This allows you to target each method explicitly without writing boilerplate like

```python
def list(self, request, *args, **kwargs):
  return super().list(self.request, *args, **kwargs)
```

You can also use it to document custom actions with specific serializers or descriptions.

Example:

```python
@extend_schema_view(
    list=extend_schema(
        description=read_md('category', 'category/list'),
        request=None,
        responses={200: OpenApiResponse(CategoryListInlineSerializer)},
    ),
    create=extend_schema(
        description=read_md('category', 'category/create'),
        request=None,
        responses={200: OpenApiResponse(CategoryCreateInlineSerializer)},
    ),
    my_custom_action=extend_schema(
        description='My custom action'
    )
)
class CategoryViewSet(viewsets.ModelViewSet):
    ...
```

Note: `read_md` is a small utility that loads a Markdown file from the Django app where
the viewset is defined. Its implementation is available at:
`kpi/utils/schema_extensions/markdown.py`

This structure keeps your schema annotations centralized and maintainable, especially in
large projects.

---

## Tags

Tags are used to group related endpoints together in the generated documentation.
They are especially useful for organizing large APIs into coherent sections in Swagger UI
or ReDoc.

Tags can be set using the `tags` parameter in `@extend_schema` or `@extend_schema_view`.
If no tags are explicitly provided, DRF-Spectacular will attempt to infer them from the
ViewSet class name or module, which may not always be ideal.

Example:

```python
@extend_schema(
    tags=['My-Category'],
    description='Returns a list of my objects.'
```

Using consistent and meaningful tags improves the developer experience when navigating
the API documentation.

---

## Inline Serializers

Inline serializers are defined using `inline_serializer()` when you want precise control
over the schema structure, especially for responses that are not backed by a traditional
DRF `Serializer` class.

These serializers are useful for defining lightweight, one-off response schemas or for
custom endpoints with specific structure requirements.

Example:

```python
CategoryListInlineSerializer = inline_serializer(
    name='CategoryListInlineSerializer',
    fields={
        'url': serializers.URLField(),  # It's better to use a custom field (like `metadata` below) to generate the desired schema.  # noqa
        'date_created': serializers.DateTimeField(),
        'name': serializers.CharField(),
        'metadata': CategoryMetaDataField()  # custom field, see below
    },
)
```

In this example, `CategoryMetaDataField` is a custom field that will typically be paired
with a custom schema extension to document it correctly (see next section on extensions).

Using inline serializers helps ensure your OpenAPI schema remains accurate without having
to create separate full serializer classes for simple structures.

---

## Custom Fields

To ensure DRF-Spectacular can correctly document advanced or unsupported field types,
we define lightweight subclasses of DRF fields. These classes allow us to attach schema
extensions via DRF-Spectacular’s plugin system.

Example:

```python
class CategoryMetaDataField(serializers.JSONField):
    pass
```

Here, `CategoryMetaDataField` is a thin wrapper around `JSONField`. By creating this
custom class, we can then target it in a schema extension (see next section) to define
its OpenAPI representation more accurately.

This approach allows you to reuse meaningful field names across serializers while
ensuring the schema remains clean and understandable.

---

## Schema Extensions

When DRF-Spectacular encounters a custom field, it needs guidance to generate an accurate
OpenAPI schema. This is achieved by creating a schema extension class that maps the field
to a specific OpenAPI structure.

To do so, create a class that inherits from `OpenApiSerializerFieldExtension` and targets
the custom field class via the `target_class` attribute.

Example:

```python
from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_basic_type
from drf_spectacular.types import OpenApiTypes

class CategoryMetaDataFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'path.to.CategoryMetaDataField'

    def map_serializer_field(self, auto_schema, direction):
        return {
            'type': 'object',
            'properties': {
                'source': build_basic_type(OpenApiTypes.STR),
                'category_type': build_basic_type(OpenApiTypes.STR),
                'ip_address': build_basic_type(OpenApiTypes.STR),
            }
        }
```

This allows you to fully control how your custom field is represented in the generated
schema. You can define the expected structure, data types, and even descriptions if
necessary.

The `target_class` must point to the full import path of the custom field class.

Alternatively, you could directly use `'rest_framework.fields.JSONField'` as the
`target_class` to apply the extension to all JSONField instances globally. However,
this is not recommended if you use multiple JSONFields in your API, as they would all
share the same schema definition, which may not reflect their actual structure.

---


### Extension Loading

To ensure that schema extensions are properly registered, the extension modules must be
imported during app initialization. This is typically done inside the `ready()` method of
your Django app's AppConfig class.

This ensures DRF-Spectacular has access to all custom extensions when generating the
schema.

Example:

```python
class MyCategoryConfig(AppConfig):
    name = 'projects.apps.category'

    def ready(self):
        # Load signals (if any)
        from . import signals  # noqa F401

        # Load all schema extension modules to register them
        from .schema_extensions.v2.category import extensions  # noqa F401

        super().ready()
```

You must explicitly import the module containing your extension class. Using `noqa F401`
ensures the import is not stripped away by linters even if unused directly.

---

## File Organization

Each Django app contains two new directories dedicated to documentation and schema
extensions:

- `docs`
- `schema_extensions`

### Markdown Documentation Files

Every Markdown file rendered in Swagger UI is located under the following path format:

```
docs/api/<version>/<endpoint>/[<nested_endpoint>/]<action>.md
```

Example:

```
docs/api/v2/category/list.md
docs/api/v2/category/create.md
```

These files are referenced using the `read_md()` utility function to populate endpoint
descriptions dynamically.

### Schema Extensions Structure

Inline serializers, custom fields, and schema extensions follow a similar logical
structure under `schema_extensions`. This directory is dedicated to the API layer and
assumes all its contents contribute to schema customization.

Unlike `docs`, which may contain other types of documentation, `schema_extensions` does
not include a nested `api/` directory.

Example:

```
schema_extensions/v2/category/serializers.py
schema_extensions/v2/category/fields.py
schema_extensions/v2/category/extensions.py
```

This structure makes the API schema logic modular and easier to maintain, allowing each
endpoint to have its own documentation and extension logic.
