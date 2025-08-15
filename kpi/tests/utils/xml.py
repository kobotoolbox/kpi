from kpi.utils.xml import fromstring_preserve_root_xmlns


def get_form_and_submission_tag_names(
    form: str, submission: str
) -> tuple[str, str]:
    submission_root_name = fromstring_preserve_root_xmlns(submission).tag
    form_xml = fromstring_preserve_root_xmlns(form)
    first_instance_child = form_xml.find('.//instance/./')
    if first_instance_child is None:
        raise ValueError(
            'Could not find the first child of <instance> in the form XML'
        )
    form_root_name = first_instance_child.tag
    return form_root_name, submission_root_name
