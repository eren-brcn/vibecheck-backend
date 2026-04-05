const test = require("node:test");
const assert = require("node:assert/strict");
const { countUnreadForConversation } = require("../utils/message-utils");

test("countUnreadForConversation counts unread DM messages correctly", () => {
  const messages = [
    { read: false, author: { _id: "u2" }, recipientId: { _id: "u1" } },
    { read: true, author: { _id: "u2" }, recipientId: { _id: "u1" } },
    { read: false, author: { _id: "u3" }, recipientId: { _id: "u1" } },
    { read: false, author: { _id: "u2" }, recipientId: { _id: "u4" } }
  ];

  const result = countUnreadForConversation({
    messages,
    otherUserId: "u2",
    currentUserId: "u1"
  });

  assert.equal(result, 1);
});
