from kpi.utils.log import logging

def do_thing_middleware(get_response):
    def do_thing(request):
        response = get_response(request)
        if request.method in ['GET', 'HEAD']:
            return response
        new_stuff = getattr(request, 'audit_log_data', {})
        old_stuff = getattr(request, 'audit_log_data_initial', {})
        logging.info(f'{old_stuff=}')
        logging.info(f'{new_stuff=}')
        return response
    return do_thing
