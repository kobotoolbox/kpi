"""
Test-execution context shared between the pytest layer and the middleware.

An autouse fixture (see the root conftest.py) stores the currently running
test's node id and its `allow_openapi_mismatch` markers here so the
middleware can consult them without inspecting the call stack.
"""

from contextvars import ContextVar

# Pytest node id of the running test, e.g.
# 'kpi/tests/api/v2/test_api_assets.py::AssetsListApiTests::test_login'
current_test_nodeid: ContextVar[str | None] = ContextVar(
    'current_test_nodeid', default=None
)

# Whitelist rules from `allow_openapi_mismatch` markers on the running test.
# Each rule is an (error_code, route, method) tuple; an empty tuple means
# "allow any mismatch in this test".
current_test_allowances: ContextVar[tuple] = ContextVar(
    'current_test_allowances', default=()
)
