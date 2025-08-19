from __future__ import annotations


class RequestMixin:

    def get_meta_from_headers(self, headers: dict) -> dict:
        meta = {}
        for key, value in headers.items():
            meta[f"HTTP_{key.replace('-', '_').upper()}"] = value
        return meta
