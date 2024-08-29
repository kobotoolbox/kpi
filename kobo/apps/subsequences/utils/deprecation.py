
def qpath_to_xpath(qpath: str, asset: 'Asset') -> str:
    """
    We have abandoned `qpath` attribute in favor of `xpath`.
    Existing projects may still use it though.
    We need to find the equivalent `xpath`
    """
    for row in asset.content['survey']:
        if '$qpath' in row and '$xpath' in row and row['$qpath'] == qpath:
            return row['$xpath']

    # Could not find it from the survey, let's try to detect it automatically
    xpaths = asset.get_attachment_xpaths(deployed=True)
    for xpath in xpaths:
        dashed_xpath = xpath.replace('/', '-')
        if dashed_xpath == qpath:
            return xpath

    raise KeyError(f'xpath for {qpath} not found')
