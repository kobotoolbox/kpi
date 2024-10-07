from __future__ import annotations

from lxml import etree

from kpi.utils.xml import check_lxml_fromstring


def get_form_and_submission_tag_names(form: str, submission: str) -> tuple[str, str]:
    submission_root_name = check_lxml_fromstring(submission.encode()).tag
    tree = etree.ElementTree(check_lxml_fromstring(form))
    root = tree.getroot()
    # We cannot use `root.nsmap` directly because the default namespace key is
    # `None`, and `find()` cannot search a namespace with equals `None`.
    #
    namespaces = {
        'default': root.nsmap[None]
    }
    element = root.find('.//default:instance', namespaces=namespaces)[0]
    form_root_name = element.tag.replace(f"{{{namespaces['default']}}}", '')

    return form_root_name, submission_root_name
