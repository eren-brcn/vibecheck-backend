const countUnreadForConversation = ({ messages = [], otherUserId, currentUserId }) => {
  return messages.filter((msg) =>
    !msg.read &&
    String(msg.author?._id || msg.author) === String(otherUserId) &&
    String(msg.recipientId?._id || msg.recipientId) === String(currentUserId)
  ).length;
};

module.exports = {
  countUnreadForConversation
};
