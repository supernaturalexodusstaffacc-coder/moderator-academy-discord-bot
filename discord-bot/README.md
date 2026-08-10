# Moderator Academy Discord Bot

This bot receives staff slash commands in Discord and queues approved requests for a live Roblox server.

## Railway variables

Create these in Railway's **Variables** tab:

| Variable | Value |
| --- | --- |
| `DISCORD_TOKEN` | Your bot token from Discord Developer Portal -> Bot. Keep this private. |
| `DISCORD_APPLICATION_ID` | `1536206886649471037` |
| `ACADEMY_COMMAND_CHANNEL_ID` | Right-click `#academy-commands` in Discord -> Copy Channel ID. |
| `ACADEMY_AUDIT_CHANNEL_ID` | Right-click `#academy-audit` -> Copy Channel ID. |
| `ACADEMY_STAFF_ROLE_IDS` | Comma-separated staff role IDs, such as `111,222,333`. |
| `ACADEMY_SHARED_SECRET` | A long random password used by Roblox and Railway only. |

Enable Discord Developer Mode first: Discord Settings -> Advanced -> Developer Mode. This reveals **Copy Channel ID** and **Copy Role ID**.

## Roblox secrets

In Creator Dashboard -> your experience -> Configure -> Secrets, create:

| Secret name | Value |
| --- | --- |
| `AcademyCommandBridgeUrl` | Your Railway public URL, e.g. `https://your-project.up.railway.app` |
| `AcademyCommandBridgeSecret` | The exact same value as `ACADEMY_SHARED_SECRET` |

Allow the Railway domain in the secret's domain list. Publish the experience and enable **Game Settings -> Security -> Allow HTTP Requests**.

## Available commands

- `/academy-status`
- `/promote username`
- `/reset-progress username`
- `/skip-module username module`
- `/send-lobby username`

Commands only run for players currently in a live game server. This is intentional: Roblox applies each command itself rather than giving Discord direct database access.
