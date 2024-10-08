def do_thing_middleware(get_response):
    def do_thing(request):
        response = get_response(request)
        breakpoint()
        return response
    return do_thing
