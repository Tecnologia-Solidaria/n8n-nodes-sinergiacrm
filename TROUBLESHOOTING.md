# Troubleshooting

Common issues and how to resolve them.

---

## "The specified package could not be loaded" after upgrading

**Symptoms:** You update the node from an older version (v2.2.5 or earlier) and n8n shows:

```
Error loading package "n8n-nodes-sinergiacrm": The specified package could not be loaded
Cause: require(...).Sinergiacrm is not a constructor
```

**Cause:** n8n caches loaded node classes in `~/.n8n/nodes/node_modules/`. When the node class names change (which happened in v2.2.6 to fix n8n 2.x compatibility), the stale cache prevents the new classes from loading.

**Fix — Docker:**

```bash
# Find your container name
docker ps

# Clear the community nodes cache
docker exec -it <container-name> sh -c "rm -rf /home/node/.n8n/nodes/node_modules/* /home/node/.n8n/nodes/package.json"

# Restart n8n
docker restart <container-name>
```

Then reinstall the node from **Settings → Community Nodes** in the n8n UI.

**Fix — npm / local install:**

```bash
# Stop n8n, then:
rm -rf ~/.n8n/nodes/node_modules/*
rm -f ~/.n8n/nodes/package.json

# Restart n8n and reinstall from the UI
```

**Fix — Kubernetes / cloud:**

Delete the contents of the `nodes/` directory inside your n8n data volume (usually `/home/node/.n8n/nodes/`), restart the pod, and reinstall.

---

## "Class could not be found"

**Symptoms:**

```
Error loading package "n8n-nodes-sinergiacrm": The specified package could not be loaded
Cause: Class could not be found. Please check if the class is named correctly.
```

**Cause:** Usually the same stale cache issue as above. In rare cases it can also mean a corrupted `npm install`.

**Fix:** Same steps as above — clear `~/.n8n/nodes/` and reinstall.

---

## Node does not appear as an AI Agent tool

**Symptoms:** The SinergiaCRM node does not show up when configuring tools for an AI Agent node.

**Cause:** n8n requires an environment variable to expose community nodes as tools.

**Fix:** Add this to your Docker environment or startup command:

```bash
N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true
```

---

## `access_token` missing error

**Symptoms:** Requests fail with a 401 or "access_token" error.

**Fix:** Check that your SinergiaCRM credentials are correctly configured in n8n:
- Domain, Client ID, and Client Secret must all be set
- The OAuth2 client must be active in SinergiaCRM (Admin → OAuth2 Clients)
- The user associated with the OAuth2 client must have API access

---

## 405 Method Not Allowed

**Symptoms:** Create or Update operations return `405 Method Not Allowed`.

**Fix:** This usually means PATCH is not enabled in your SinergiaCRM instance. Ensure the JSON API is properly configured and that PATCH requests are allowed.

---

## Package fails to install on n8n 2.x

**Symptoms:** The n8n UI shows a generic install error when adding the community node.

**Cause:** n8n 2.x changed how community packages are installed (using `--install-strategy=shallow`). This can occasionally cause dependency conflicts.

**Fix:**

1. Clear the community nodes directory (see first section above)
2. If the problem persists, ensure `N8N_UNVERIFIED_PACKAGES_ENABLED=true` is set in your environment
3. Restart n8n and try again

---

## General tips

- After any upgrade of n8n itself (not just the node), community nodes may need to be reinstalled
- If something breaks, clearing `~/.n8n/nodes/` and restarting is almost always the fix
- Check the n8n logs (`docker logs <container>`) for detailed error messages
