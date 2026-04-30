from kpi.utils.xml import fromstring_preserve_root_xmlns


def get_form_and_submission_tag_names(
    form: str, submission: str
) -> tuple[str, str]:
    submission_root_name = fromstring_preserve_root_xmlns(submission).tag
    form_xml = fromstring_preserve_root_xmlns(form)
    # Skip secondary instances (which have an `id` attribute, e.g.
    # `<instance id="choices" src="...">`) and find the primary one
    first_instance_child = None
    for inst in form_xml.findall('.//instance'):
        if 'id' not in inst.attrib and len(inst):
            first_instance_child = inst[0]
            break
    if first_instance_child is None:
        raise ValueError(
            'Could not find the first child of <instance> in the form XML'
        )
    form_root_name = first_instance_child.tag
    return form_root_name, submission_root_name
