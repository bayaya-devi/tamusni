-- The legacy users.preferred_topic remains a compatibility field.  All account
-- preferences are now represented in topic_subscriptions, including old accounts.
INSERT OR IGNORE INTO topic_subscriptions (user_id, topic, created_at)
SELECT id, preferred_topic, COALESCE(created_at, CURRENT_TIMESTAMP)
FROM users
WHERE preferred_topic IS NOT NULL
  AND TRIM(preferred_topic) <> '';
