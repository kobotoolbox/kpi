from __future__ import annotations

from kobo.apps.markdownx_uploader.admin import MarkdownxModelAdminBase
from ..models import SitewideMessage


class SitewideMessageAdmin(MarkdownxModelAdminBase):

    model = SitewideMessage
