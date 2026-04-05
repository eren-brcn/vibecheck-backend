const sanitizeMessageContent = (input) => {
  const value = String(input || "").trim();
  if (!value) {
    return { ok: false, reason: "Message cannot be empty" };
  }
  if (value.length > 2000) {
    return { ok: false, reason: "Message is too long" };
  }
  return { ok: true, content: value };
};

const isDmBlocked = ({ senderBlockedUsers = [], recipientBlockedUsers = [], senderId, recipientId }) => {
  const senderBlockedRecipient = (senderBlockedUsers || []).some((id) => String(id) === String(recipientId));
  const recipientBlockedSender = (recipientBlockedUsers || []).some((id) => String(id) === String(senderId));
  return senderBlockedRecipient || recipientBlockedSender;
};

module.exports = {
  sanitizeMessageContent,
  isDmBlocked
};
