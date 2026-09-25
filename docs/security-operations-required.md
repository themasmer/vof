# Required external security operations

The source changes remove exposed values from the working tree, but do not rotate
the third-party credentials that were previously committed. Before deployment:

1. Revoke and reissue AWS SMTP, Twilio, JWT/HMAC, Jitsi, and private-key material.
2. Load replacement values through the deployment secret manager using `.env.example` as a key list.
3. Purge the exposed values from every reachable repository history, image layer, backup, and build log.
4. Invalidate all browser sessions after deploying the new JWT/refresh-token configuration.
5. Record credential identifiers and rotation time in the incident/change system, never the values.
