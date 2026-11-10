const test = require("node:test");
const assert = require("node:assert/strict");

const createOriginGuard = require("../../src/middleware/originGuard");

const TRUSTED_ORIGIN = "http://localhost:5173";
const guard = createOriginGuard(TRUSTED_ORIGIN);

function runGuard({ method = "POST", origin } = {}) {
  const req = {
    method,
    get(headerName) {
      assert.equal(headerName, "Origin");
      return origin;
    },
  };

  const result = {
    statusCode: null,
    body: null,
    nextCalled: false,
  };

  const res = {
    status(statusCode) {
      result.statusCode = statusCode;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    },
  };

  guard(req, res, () => {
    result.nextCalled = true;
  });

  return result;
}

test("allows the configured frontend origin", () => {
  const result = runGuard({ origin: TRUSTED_ORIGIN });

  assert.equal(result.nextCalled, true);
  assert.equal(result.statusCode, null);
});

test("rejects a foreign origin", () => {
  const result = runGuard({ origin: "https://attacker.example" });

  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 403);
  assert.equal(result.body.success, false);
});

test("rejects a null origin", () => {
  const result = runGuard({ origin: "null" });

  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 403);
});

test("rejects malformed origins and origins containing a path", () => {
  for (const origin of [
    "not-a-url",
    "http://localhost:5173/untrusted-path",
  ]) {
    const result = runGuard({ origin });

    assert.equal(result.nextCalled, false);
    assert.equal(result.statusCode, 403);
  }
});

test("allows requests without Origin for non-browser clients", () => {
  const result = runGuard();

  assert.equal(result.nextCalled, true);
  assert.equal(result.statusCode, null);
});

test("does not check safe HTTP methods", () => {
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    const result = runGuard({
      method,
      origin: "https://attacker.example",
    });

    assert.equal(result.nextCalled, true);
    assert.equal(result.statusCode, null);
  }
});

test("supports the Docker frontend origin", () => {
  const dockerGuard = createOriginGuard("http://localhost:8080");
  const req = {
    method: "PATCH",
    get: () => "http://localhost:8080",
  };

  let nextCalled = false;

  dockerGuard(req, {}, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});

test("rejects an invalid configured frontend URL", () => {
  assert.throws(
    () => createOriginGuard("not-a-valid-frontend-url"),
    /FRONTEND_URL must be a valid absolute URL/
  );
});
