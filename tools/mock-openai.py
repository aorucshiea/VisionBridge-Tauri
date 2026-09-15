# -*- coding: utf-8 -*-
"""Mock OpenAI-compatible server on 127.0.0.1:1234 (LM Studio's port).

Serves GET /v1/models in the OpenAI list shape so the app's probe can be
verified end-to-end without LM Studio running. Logs every request so we can
also confirm no CORS preflight is sent by the plugin-based fetch.
"""
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

LOG = []


class Handler(BaseHTTPRequestHandler):
    def _respond(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        LOG.append(f"GET {self.path}")
        if self.path.rstrip("/").endswith("/models"):
            self._respond(200, {
                "object": "list",
                "data": [
                    {"id": "qwen3-vl-plus", "object": "model", "owned_by": "organization_owner"},
                    {"id": "text-embedding-nomic-embed-text-v1.5", "object": "model", "owned_by": "organization_owner"},
                    {"id": "qwen2.5-7b-instruct", "object": "model", "owned_by": "organization_owner"},
                ],
            })
        else:
            self._respond(200, {"ok": True})

    def do_OPTIONS(self):
        LOG.append(f"OPTIONS {self.path}  <-- preflight! (should NEVER happen with plugin fetch)")
        self._respond(200, {})

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        self.rfile.read(length)
        LOG.append(f"POST {self.path}")
        self._respond(200, {"id": "chatcmpl-mock", "object": "chat.completion",
                            "choices": [{"message": {"role": "assistant", "content": "OK"}}]})

    def log_message(self, *a):
        pass


def main():
    srv = ThreadingHTTPServer(("127.0.0.1", 1234), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    print("mock listening on 127.0.0.1:1234", flush=True)
    try:
        while True:
            time.sleep(1)
    finally:
        srv.shutdown()


if __name__ == "__main__":
    main()
