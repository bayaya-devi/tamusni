export const AVAILABLE_TOPICS = ["Intelligence artificielle", "Innovation", "Robotique", "Cybersécurité", "Espace"];

const allowedTopics = new Set(AVAILABLE_TOPICS);

// Accept the legacy single value while making the subscription list the source of truth.
export function normalizeTopics(value, legacyValue) {
  const candidates = Array.isArray(value) ? value : value == null ? [] : [value];
  if (!candidates.length && legacyValue != null) candidates.push(legacyValue);
  return [...new Set(candidates.map(topic => String(topic || "").trim()).filter(topic => allowedTopics.has(topic)))];
}

export async function replaceTopicSubscriptions(db, userId, selectedTopics, createdAt = new Date().toISOString()) {
  const statements = [db.prepare("DELETE FROM topic_subscriptions WHERE user_id=?").bind(userId)];
  for (const topic of selectedTopics) {
    statements.push(db.prepare("INSERT INTO topic_subscriptions(user_id,topic,created_at) VALUES(?,?,?)").bind(userId, topic, createdAt));
  }
  await db.batch(statements);
}
