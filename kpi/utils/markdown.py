from django.utils.module_loading import import_string
from markdownx.settings import MARKDOWNX_MARKDOWNIFY_FUNCTION

markdownify = import_string(MARKDOWNX_MARKDOWNIFY_FUNCTION)
