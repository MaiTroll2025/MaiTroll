# Maitalent Sync Investigation Questions

Please answer these questions for the sync issue we are investigating:

1. What is the expected data flow for the sync between Mai Troll and Maitalent.fun?
2. Are there any recent changes to the sync endpoint, webhook, API keys, or authentication flow?
3. Is there any known issue with duplicate records, missing fields, or partial syncs?
4. Can you confirm whether the sync is currently being triggered on create, update, and delete events?
5. Are there any logs, error messages, or failed jobs we should inspect on your side?
6. What specific fields are supposed to be synchronized, and which ones are currently not syncing?
7. Are there any rate limits, timeout limits, or queueing issues affecting the sync?
8. Can you share the exact expected response format and success/failure behavior for the sync API?
9. Is there any difference between the staging and production environments for this sync?
10. What are the expected environment values for the sync configuration (for example: API base URL, webhook URL, auth token, environment name, feature flags, and any secret/key names)?
11. Are the expected environment variables set correctly in the relevant environment(s), and are any of them missing, stale, or mismatched?
12. What should we verify in the app config, deployment settings, and server environment to confirm the sync is pointing to the correct endpoint and credentials?
13. What would you recommend as the quickest way to reproduce and isolate the problem?

Please reply with a clear answer for each question, including any relevant logs, examples, or next steps, and please include the current environment values where safe to share.
