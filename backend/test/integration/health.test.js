const test = require("node:test");
const assert = require("node:assert/strict");

const BASE_URL = "http://localhost:5001";

test("GET /api/health returns a healthy API response", async () => {
  const response = await fetch(`${BASE_URL}/api/health`);

  assert.equal(response.status, 200);

  const body = await response.json();

  assert.equal(body.success, true);
  assert.equal(body.message, "SafeLayer API is healthy");
});
