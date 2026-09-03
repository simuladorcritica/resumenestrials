"""Pruebas sin red para la selección segura de credenciales de Search Console."""
from __future__ import annotations

import importlib.util
import os
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

MODULE_PATH = Path(__file__).with_name("search-console-fetch.py")
SPEC = importlib.util.spec_from_file_location("search_console_fetch", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


def fake_google_modules(*, invalid_grant: bool = False):
    google = types.ModuleType("google")
    auth = types.ModuleType("google.auth")
    exceptions = types.ModuleType("google.auth.exceptions")
    transport = types.ModuleType("google.auth.transport")
    requests = types.ModuleType("google.auth.transport.requests")
    oauth2 = types.ModuleType("google.oauth2")
    credentials = types.ModuleType("google.oauth2.credentials")
    service_account = types.ModuleType("google.oauth2.service_account")

    class RefreshError(Exception):
        pass

    class Request:
        pass

    class Credentials:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

        def refresh(self, _request):
            if invalid_grant:
                raise RefreshError("invalid_grant")

    class ServiceCredentials:
        @staticmethod
        def from_service_account_info(info, scopes):
            return {"info": info, "scopes": scopes}

    exceptions.RefreshError = RefreshError
    requests.Request = Request
    credentials.Credentials = Credentials
    service_account.Credentials = ServiceCredentials
    oauth2.credentials = credentials
    oauth2.service_account = service_account
    google.auth = auth
    google.oauth2 = oauth2
    return {
        "google": google,
        "google.auth": auth,
        "google.auth.exceptions": exceptions,
        "google.auth.transport": transport,
        "google.auth.transport.requests": requests,
        "google.oauth2": oauth2,
        "google.oauth2.credentials": credentials,
        "google.oauth2.service_account": service_account,
    }


class CredentialSelectionTests(unittest.TestCase):
    def test_no_credentials_has_explicit_error(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(SystemExit, "Search Console no configurado"):
                MODULE.credentials_from_environment()

    def test_partial_oauth_is_rejected_before_api_access(self):
        with patch.dict(os.environ, {"GSC_OAUTH_CLIENT_ID": "test-client"}, clear=True):
            with self.assertRaisesRegex(SystemExit, "Configuración OAuth incompleta"):
                MODULE.credentials_from_environment()

    def test_oauth_is_preferred_and_uses_readonly_scope(self):
        environment = {
            "GSC_OAUTH_CLIENT_ID": "test-client",
            "GSC_OAUTH_CLIENT_SECRET": "test-secret",
            "GSC_OAUTH_REFRESH_TOKEN": "test-refresh",
            "GSC_SERVICE_ACCOUNT_JSON": '{"type":"service_account"}',
        }
        with patch.dict(os.environ, environment, clear=True), patch.dict(
            sys.modules, fake_google_modules(), clear=False
        ):
            credential, provider = MODULE.credentials_from_environment()
        self.assertEqual(provider, "oauth-user")
        self.assertEqual(credential.kwargs["scopes"], [MODULE.SCOPE])

    def test_invalid_grant_is_visible_without_echoing_token(self):
        environment = {
            "GSC_OAUTH_CLIENT_ID": "test-client",
            "GSC_OAUTH_CLIENT_SECRET": "test-secret",
            "GSC_OAUTH_REFRESH_TOKEN": "test-refresh",
        }
        with patch.dict(os.environ, environment, clear=True), patch.dict(
            sys.modules, fake_google_modules(invalid_grant=True), clear=False
        ):
            with self.assertRaises(SystemExit) as raised:
                MODULE.credentials_from_environment()
        message = str(raised.exception)
        self.assertIn("invalid_grant", message)
        self.assertIn("expiró o fue revocado", message)
        self.assertNotIn("test-refresh", message)


if __name__ == "__main__":
    unittest.main()
