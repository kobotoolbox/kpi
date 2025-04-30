import importlib
import os
from pathlib import Path

from django.apps import apps


def read_md(app_name: str, filename: str, api_version: str = 'v2') -> str:
    """
    Read a markdown file from <app>/api/<version>/docs/<filename> based on the
    Django app name.
    """
    try:
        # Get app config
        app_config = apps.get_app_config(app_name)
    except LookupError:
        raise ValueError(f"Django app '{app_name}' not found.")

    base_filename, extension = os.path.splitext(filename)
    if extension == '':
        filename = f'{filename}.md'

    # Get Django app module path
    app_module = importlib.import_module(app_config.name)
    app_path = Path(app_module.__file__).resolve().parent

    doc_path = app_path / 'docs' / 'api' / api_version / filename

    if not doc_path.exists():
        raise FileNotFoundError(f'Markdown file not found: {doc_path}')

    return doc_path.read_text(encoding='utf-8')
