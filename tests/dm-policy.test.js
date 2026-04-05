const test = require("node:test");
const assert = require("node:assert/strict");
const { sanitizeMessageContent, isDmBlocked } = require("../utils/dm-policy");

test("sanitizeMessageContent rejects empty values", () => {
  const result = sanitizeMessageContent("   ");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "Message cannot be empty");
});

test("sanitizeMessageContent trims valid message", () => {
  const result = sanitizeMessageContent(" hello ");
  assert.equal(result.ok, true);
  assert.equal(result.content, "hello");
});

test("isDmBlocked returns true when recipient blocked sender", () => {
  const blocked = isDmBlocked({
    senderBlockedUsers: [],
    recipientBlockedUsers: ["user-1"],
    senderId: "user-1",
    recipientId: "user-2"
  });
  assert.equal(blocked, true);
});

test("isDmBlocked returns false when neither blocked", () => {
  const blocked = isDmBlocked({
    senderBlockedUsers: [],
    recipientBlockedUsers: [],
    senderId: "user-1",
    recipientId: "user-2"
  });
  assert.equal(blocked, false);
});
