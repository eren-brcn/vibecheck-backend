const onlineCounts = new Map();
const socketToUser = new Map();
const lastSeenTimes = new Map();

const toKey = (userId) => String(userId || "").trim();

const setOnline = (userId, socketId) => {
  const key = toKey(userId);
  if (!key || !socketId) {
    return { changed: false, userId: key };
  }

  const previousSocketUser = socketToUser.get(socketId);
  if (previousSocketUser && previousSocketUser !== key) {
    setOffline(socketId);
  }

  socketToUser.set(socketId, key);
  const previousCount = onlineCounts.get(key) || 0;
  onlineCounts.set(key, previousCount + 1);

  return { changed: previousCount === 0, userId: key };
};

const setOffline = (socketId) => {
  const userId = socketToUser.get(socketId);
  if (!userId) {
    return { changed: false, userId: null };
  }

  socketToUser.delete(socketId);
  const previousCount = onlineCounts.get(userId) || 0;
  lastSeenTimes.set(userId, Date.now());
  
  if (previousCount <= 1) {
    onlineCounts.delete(userId);
    return { changed: true, userId };
  }

  onlineCounts.set(userId, previousCount - 1);
  return { changed: false, userId };
};

const isOnline = (userId) => {
  const key = toKey(userId);
  return Boolean(key && (onlineCounts.get(key) || 0) > 0);
};

const getLastSeen = (userId) => {
  const key = toKey(userId);
  return lastSeenTimes.get(key) || null;
};

module.exports = {
  setOnline,
  setOffline,
  isOnline,
  getLastSeen,
};
