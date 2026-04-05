const test = require("node:test");
const assert = require("node:assert/strict");
const presenceStore = require("../presence-store");

test("presence store tracks online/offline and last seen", () => {
  const userId = "presence-user";
  const socketId = "socket-123";

  const onlineResult = presenceStore.setOnline(userId, socketId);
  assert.equal(onlineResult.changed, true);
  assert.equal(presenceStore.isOnline(userId), true);

  const offlineResult = presenceStore.setOffline(socketId);
  assert.equal(offlineResult.changed, true);
  assert.equal(String(offlineResult.userId), userId);
  assert.equal(presenceStore.isOnline(userId), false);

  const lastSeen = presenceStore.getLastSeen(userId);
  assert.equal(typeof lastSeen, "number");
  assert.ok(lastSeen > 0);
});
