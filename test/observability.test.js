import { test } from "node:test";
import assert from "node:assert/strict";
import { createSentrySink, configureErrorSink, logPilotEvent, sanitizeDetails } from "../src/services/observability.js";

test("createSentrySink returns null (console fallback) when no DSN is configured", () => {
  assert.equal(createSentrySink({ dsn: null }), null);
  assert.equal(createSentrySink({}), null);
});

test("createSentrySink returns null for a malformed DSN and never throws", () => {
  assert.equal(createSentrySink({ dsn: "not-a-real-dsn" }), null);
  assert.equal(createSentrySink({ dsn: "https://missing-project-id.example.com" }), null);
});

test("createSentrySink posts a valid envelope to Sentry's documented ingestion endpoint", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200 };
  };
  const sink = createSentrySink({ dsn: "https://publickey123@o0.ingest.sentry.io/4507", fetchImpl, release: "1.2.3", environment: "test" });
  assert.ok(sink, "a valid DSN must produce a usable sink function");

  await sink({ type: "js_exception", severity: "error", app: "Alwenda", environment: "test", releaseVersion: "1.2.3", occurredAt: "2026-01-01T00:00:00.000Z", details: { message: "boom" } });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://o0.ingest.sentry.io/api/4507/envelope/?sentry_key=publickey123&sentry_version=7");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["Content-Type"], "application/x-sentry-envelope");

  const lines = calls[0].options.body.split("\n");
  assert.equal(lines.length, 3, "an envelope is exactly 3 newline-delimited JSON lines: envelope header, item header, item payload");
  const envelopeHeader = JSON.parse(lines[0]);
  const itemHeader = JSON.parse(lines[1]);
  const eventPayload = JSON.parse(lines[2]);
  assert.ok(envelopeHeader.event_id);
  assert.ok(envelopeHeader.sent_at);
  assert.deepEqual(itemHeader, { type: "event" });
  assert.equal(eventPayload.level, "error");
  assert.equal(eventPayload.release, "1.2.3");
  assert.equal(eventPayload.environment, "test");
  assert.deepEqual(eventPayload.extra.details, { message: "boom" });
});

test("a sink failure never throws or breaks the caller", async () => {
  const sink = createSentrySink({
    dsn: "https://publickey123@o0.ingest.sentry.io/4507",
    fetchImpl: async () => {
      throw new Error("network down");
    }
  });
  await assert.doesNotReject(sink({ type: "js_exception", severity: "error", details: {} }));
});

test("logPilotEvent routes through configureErrorSink() when set, and falls back to console otherwise", async () => {
  const received = [];
  configureErrorSink((event) => {
    received.push(event);
  });
  logPilotEvent("route_error", { path: "/explore" }, { severity: "error" });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(received.length, 1);
  assert.equal(received[0].type, "route_error");

  configureErrorSink(null);
  const event = logPilotEvent("route_error", { path: "/home" });
  assert.equal(event.type, "route_error");
});

test("sanitizeDetails redaction still applies to whatever reaches the configured sink", async () => {
  const received = [];
  configureErrorSink((event) => received.push(event));
  logPilotEvent("supabase_failure", { context: "fetchMyListings", note: "reported by person@example.com", accessToken: "secret" }, { severity: "error" });
  await new Promise((resolve) => setTimeout(resolve, 0));
  configureErrorSink(null);

  const serialized = JSON.stringify(received[0]);
  assert.ok(!serialized.includes("person@example.com"), "email addresses in string values must be redacted");
  assert.ok(!serialized.includes("secret"), "keys matching the sensitive-key pattern (accessToken) must be redacted wholesale");
  assert.deepEqual(sanitizeDetails({ ordinary: true }), { ordinary: true });
});
