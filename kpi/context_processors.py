def dev_mode(request):
    out = {}
    out['livereload_script']  = 'http://localhost:35729/livereload.js'
    return out