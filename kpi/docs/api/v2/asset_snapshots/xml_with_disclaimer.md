### Implements part of the OpenRosa Form List API.

This endpoint is used by Enketo to fetch and return the full XML form.
It behaves like the standard retrieve endpoint but includes an additional `<note>`
node containing the disclaimer, if one exists.
