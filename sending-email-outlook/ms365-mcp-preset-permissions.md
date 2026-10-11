# Microsoft 365 MCP Server — Preset Permission Reference

Generated 2026-10-12 from `@softeria/ms-365-mcp-server` v0.161.4 by running
`npx @softeria/ms-365-mcp-server [--org-mode] --preset <name> --list-permissions` for every preset.

Use this to grant exactly the delegated Graph permissions each preset needs in your Azure AD app
registration (App registrations → your app → API permissions → Microsoft Graph → Delegated permissions).

## How the two modes work

- **personal mode** (default, no flag): user delegated sign-in. Tools whose Graph calls need
  org-only scopes are *not registered at all* — e.g. every Teams tool is skipped, which is why
  `--preset teams` shows 0 permissions in personal mode. Use it for one user's own mailbox,
  calendar, OneDrive, notes, tasks and contacts.
- **org mode** (`--org-mode`): registers everything, including Teams, shared mailboxes,
  SharePoint/Planner and user directory tools. Requires the wider scope set below.

The listed scopes are exactly what the server requests from MSAL at login, with redundant
scopes already collapsed (hierarchy-aware: `Mail.ReadWrite` covers `Mail.Read`,
`Files.ReadWrite.All` covers `Files.Read.All` and `Files.Read`, etc.).
When you combine presets (`--preset mail,calendar`), take the **union** of their scope lists.

Scopes marked **★ admin consent** below (all `.All` and `.Shared` scopes) require a tenant
admin to grant consent in almost every tenant; the rest are usually user-consentable.

## Summary

Tool counts below are the preset's own Graph tools (the live tool list is a bit larger — account
tools like `login`/`logout` and scope-free utilities like `download-bytes`/`get-upload-url` are
always registered and need no extra permissions).

| Preset | Graph tools (personal) | Graph tools (org) | Personal-mode scopes | Org-mode scopes |
|---|:---:|:---:|:---:|:---:|
| `mail` | 43 | 43 | 5 | 5 |
| `calendar` | 36 | 43 | 4 | 7 |
| `files` | 19 | 22 | 1 | 3 |
| `personal` | 156 | 164 | 13 | 20 |
| `work` | 15 | 171 | 2 | 55 |
| `excel` | 23 | 23 | 1 | 1 |
| `contacts` | 13 | 13 | 1 | 1 |
| `tasks` | 25 | 25 | 1 | 1 |
| `onenote` | 12 | 26 | 3 | 3 |
| `search` | 1 | 4 | 1 | 8 |
| `users` | 2 | 9 | 1 | 4 |
| `outlook` | 88 | 90 | 7 | 8 |
| `onedrive` | 19 | 20 | 1 | 2 |
| `teams` | 0 | 69 | 0 | 31 |
| `teams-write` | 0 | 10 | 0 | 6 |
| `all` | 173 | 343 | 13 | 62 |

---

## `--preset mail`

Preset Graph tools: **43** in personal mode, **43** in org mode.

### Personal mode (default)

- Mail.ReadWrite
- Mail.Send
- MailboxSettings.Read
- MailboxSettings.ReadWrite
- User.Read

### Org mode (`--org-mode`)

- Mail.ReadWrite
- Mail.Send
- MailboxSettings.Read
- MailboxSettings.ReadWrite
- User.Read

## `--preset calendar`

Preset Graph tools: **36** in personal mode, **43** in org mode.

### Personal mode (default)

- Calendars.ReadWrite
- MailboxSettings.Read
- MailboxSettings.ReadWrite
- User.Read

### Org mode (`--org-mode`)

- Calendars.Read.Shared  ★ admin consent  *(org-mode addition)*
- Calendars.ReadWrite
- MailboxSettings.Read
- MailboxSettings.ReadWrite
- Place.Read.All  ★ admin consent  *(org-mode addition)*
- Place.ReadWrite.All  ★ admin consent  *(org-mode addition)*
- User.Read

## `--preset files`

Preset Graph tools: **19** in personal mode, **22** in org mode.

### Personal mode (default)

- Files.ReadWrite

### Org mode (`--org-mode`)

- Files.Read.All  ★ admin consent  *(org-mode addition)*
- Files.ReadWrite
- SensitivityLabel.Read  *(org-mode addition)*

## `--preset personal`

Preset Graph tools: **156** in personal mode, **164** in org mode.

### Personal mode (default)

- Calendars.ReadWrite
- Contacts.ReadWrite
- Files.ReadWrite
- Mail.ReadWrite
- Mail.Send
- MailboxSettings.Read
- MailboxSettings.ReadWrite
- Notes.Create
- Notes.Read
- Notes.ReadWrite
- Tasks.ReadWrite
- User.Read
- User.ReadWrite

### Org mode (`--org-mode`)

- Calendars.Read.Shared  ★ admin consent  *(org-mode addition)*
- Calendars.ReadWrite
- ChannelMessage.Read.All  ★ admin consent  *(org-mode addition)*
- Chat.Read  *(org-mode addition)*
- Contacts.ReadWrite
- Files.Read.All  ★ admin consent  *(org-mode addition)*
- Files.ReadWrite
- Mail.ReadWrite
- Mail.Send
- MailboxSettings.Read
- MailboxSettings.ReadWrite
- Notes.Create
- Notes.Read
- Notes.ReadWrite
- People.Read  *(org-mode addition)*
- SensitivityLabel.Read  *(org-mode addition)*
- Sites.Read.All  ★ admin consent  *(org-mode addition)*
- Tasks.ReadWrite
- User.Read
- User.ReadWrite

## `--preset work`

Preset Graph tools: **15** in personal mode, **171** in org mode.

### Personal mode (default)

- Tasks.ReadWrite
- User.Read

### Org mode (`--org-mode`)

- Calendars.Read  *(org-mode addition)*
- Calendars.Read.Shared  ★ admin consent  *(org-mode addition)*
- CallTranscripts.Read.All  ★ admin consent  *(org-mode addition)*
- Channel.Create  *(org-mode addition)*
- Channel.Delete.All  ★ admin consent  *(org-mode addition)*
- Channel.ReadBasic.All  ★ admin consent  *(org-mode addition)*
- ChannelMessage.Read.All  ★ admin consent  *(org-mode addition)*
- ChannelMessage.ReadWrite  *(org-mode addition)*
- ChannelMessage.Send  *(org-mode addition)*
- ChannelSettings.Read.All  ★ admin consent  *(org-mode addition)*
- ChannelSettings.ReadWrite.All  ★ admin consent  *(org-mode addition)*
- Chat.Create  *(org-mode addition)*
- Chat.ReadWrite  *(org-mode addition)*
- ChatMember.Read  *(org-mode addition)*
- ChatMessage.Read  *(org-mode addition)*
- ChatMessage.Send  *(org-mode addition)*
- Directory.Read.All  ★ admin consent  *(org-mode addition)*
- Files.Read.All  ★ admin consent  *(org-mode addition)*
- Group.Read.All  ★ admin consent  *(org-mode addition)*
- Group.ReadWrite.All  ★ admin consent  *(org-mode addition)*
- GroupMember.Read.All  ★ admin consent  *(org-mode addition)*
- GroupMember.ReadWrite.All  ★ admin consent  *(org-mode addition)*
- Mail.Read  *(org-mode addition)*
- Mail.Read.Shared  ★ admin consent  *(org-mode addition)*
- Mail.ReadWrite.Shared  ★ admin consent  *(org-mode addition)*
- Mail.Send.Shared  ★ admin consent  *(org-mode addition)*
- Notes.Create  *(org-mode addition)*
- Notes.Read  *(org-mode addition)*
- Notes.ReadWrite  *(org-mode addition)*
- OnlineMeetingArtifact.Read.All  ★ admin consent  *(org-mode addition)*
- OnlineMeetingRecording.Read.All  ★ admin consent  *(org-mode addition)*
- OnlineMeetings.Read  *(org-mode addition)*
- OnlineMeetings.ReadWrite  *(org-mode addition)*
- OnlineMeetingTranscript.Read.All  ★ admin consent  *(org-mode addition)*
- People.Read  *(org-mode addition)*
- Place.Read.All  ★ admin consent  *(org-mode addition)*
- Place.ReadWrite.All  ★ admin consent  *(org-mode addition)*
- Presence.Read  *(org-mode addition)*
- Presence.Read.All  ★ admin consent  *(org-mode addition)*
- Presence.ReadWrite  *(org-mode addition)*
- Sites.Manage.All  ★ admin consent  *(org-mode addition)*
- Sites.Read.All  ★ admin consent  *(org-mode addition)*
- Sites.ReadWrite.All  ★ admin consent  *(org-mode addition)*
- Tasks.ReadWrite
- Team.ReadBasic.All  ★ admin consent  *(org-mode addition)*
- TeamMember.Read.All  ★ admin consent  *(org-mode addition)*
- TeamMember.ReadWrite.All  ★ admin consent  *(org-mode addition)*
- TeamsActivity.Send  *(org-mode addition)*
- TeamsAppInstallation.ReadForUser  *(org-mode addition)*
- TeamsTab.Read.All  ★ admin consent  *(org-mode addition)*
- TeamworkCustomEmoji.Create  *(org-mode addition)*
- TeamworkCustomEmoji.Read  *(org-mode addition)*
- User.Read
- User.Read.All  ★ admin consent  *(org-mode addition)*
- VirtualEvent.Read  *(org-mode addition)*

## `--preset excel`

Preset Graph tools: **23** in personal mode, **23** in org mode.

### Personal mode (default)

- Files.ReadWrite

### Org mode (`--org-mode`)

- Files.ReadWrite

## `--preset contacts`

Preset Graph tools: **13** in personal mode, **13** in org mode.

### Personal mode (default)

- Contacts.ReadWrite

### Org mode (`--org-mode`)

- Contacts.ReadWrite

## `--preset tasks`

Preset Graph tools: **25** in personal mode, **25** in org mode.

### Personal mode (default)

- Tasks.ReadWrite

### Org mode (`--org-mode`)

- Tasks.ReadWrite

## `--preset onenote`

Preset Graph tools: **12** in personal mode, **26** in org mode.

### Personal mode (default)

- Notes.Create
- Notes.Read
- Notes.ReadWrite

### Org mode (`--org-mode`)

- Notes.Create
- Notes.Read
- Notes.ReadWrite

## `--preset search`

Preset Graph tools: **1** in personal mode, **4** in org mode.

### Personal mode (default)

- Files.Read

### Org mode (`--org-mode`)

- Calendars.Read  *(org-mode addition)*
- ChannelMessage.Read.All  ★ admin consent  *(org-mode addition)*
- Chat.Read  *(org-mode addition)*
- Files.Read
- Files.Read.All  ★ admin consent  *(org-mode addition)*
- Mail.Read  *(org-mode addition)*
- People.Read  *(org-mode addition)*
- Sites.Read.All  ★ admin consent  *(org-mode addition)*

## `--preset users`

Preset Graph tools: **2** in personal mode, **9** in org mode.

### Personal mode (default)

- User.Read

### Org mode (`--org-mode`)

- Directory.Read.All  ★ admin consent  *(org-mode addition)*
- People.Read  *(org-mode addition)*
- User.Read
- User.Read.All  ★ admin consent  *(org-mode addition)*

## `--preset outlook`

Preset Graph tools: **88** in personal mode, **90** in org mode.

### Personal mode (default)

- Calendars.ReadWrite
- Contacts.ReadWrite
- Mail.ReadWrite
- Mail.Send
- MailboxSettings.Read
- MailboxSettings.ReadWrite
- User.Read

### Org mode (`--org-mode`)

- Calendars.Read.Shared  ★ admin consent  *(org-mode addition)*
- Calendars.ReadWrite
- Contacts.ReadWrite
- Mail.ReadWrite
- Mail.Send
- MailboxSettings.Read
- MailboxSettings.ReadWrite
- User.Read

## `--preset onedrive`

Preset Graph tools: **19** in personal mode, **20** in org mode.

### Personal mode (default)

- Files.ReadWrite

### Org mode (`--org-mode`)

- Files.Read.All  ★ admin consent  *(org-mode addition)*
- Files.ReadWrite

## `--preset teams`

Preset Graph tools: **0** in personal mode, **69** in org mode. In personal mode only the
scope-free helpers remain (account tools, `parse-teams-url`, `download-bytes*`) — every Teams
Graph tool is org-only.

### Personal mode (default)

- *(none — no Teams Graph tools register in personal mode; all of them are org-only)*

### Org mode (`--org-mode`)

- CallTranscripts.Read.All  ★ admin consent  *(org-mode addition)*
- Channel.Create  *(org-mode addition)*
- Channel.Delete.All  ★ admin consent  *(org-mode addition)*
- Channel.ReadBasic.All  ★ admin consent  *(org-mode addition)*
- ChannelMessage.Read.All  ★ admin consent  *(org-mode addition)*
- ChannelMessage.ReadWrite  *(org-mode addition)*
- ChannelMessage.Send  *(org-mode addition)*
- ChannelSettings.Read.All  ★ admin consent  *(org-mode addition)*
- ChannelSettings.ReadWrite.All  ★ admin consent  *(org-mode addition)*
- Chat.Create  *(org-mode addition)*
- Chat.ReadWrite  *(org-mode addition)*
- ChatMember.Read  *(org-mode addition)*
- ChatMessage.Read  *(org-mode addition)*
- ChatMessage.Send  *(org-mode addition)*
- OnlineMeetingArtifact.Read.All  ★ admin consent  *(org-mode addition)*
- OnlineMeetingRecording.Read.All  ★ admin consent  *(org-mode addition)*
- OnlineMeetings.Read  *(org-mode addition)*
- OnlineMeetings.ReadWrite  *(org-mode addition)*
- OnlineMeetingTranscript.Read.All  ★ admin consent  *(org-mode addition)*
- Presence.Read  *(org-mode addition)*
- Presence.Read.All  ★ admin consent  *(org-mode addition)*
- Presence.ReadWrite  *(org-mode addition)*
- Team.ReadBasic.All  ★ admin consent  *(org-mode addition)*
- TeamMember.Read.All  ★ admin consent  *(org-mode addition)*
- TeamMember.ReadWrite.All  ★ admin consent  *(org-mode addition)*
- TeamsActivity.Send  *(org-mode addition)*
- TeamsAppInstallation.ReadForUser  *(org-mode addition)*
- TeamsTab.Read.All  ★ admin consent  *(org-mode addition)*
- TeamworkCustomEmoji.Create  *(org-mode addition)*
- TeamworkCustomEmoji.Read  *(org-mode addition)*
- VirtualEvent.Read  *(org-mode addition)*

## `--preset teams-write`

Preset Graph tools: **0** in personal mode, **10** in org mode (same personal-mode behavior as
`teams` above — only scope-free helper tools remain).

### Personal mode (default)

- *(none — no Teams Graph tools register in personal mode; all of them are org-only)*

### Org mode (`--org-mode`)

- Channel.ReadBasic.All  ★ admin consent  *(org-mode addition)*
- ChannelMessage.Send  *(org-mode addition)*
- Chat.ReadBasic  *(org-mode addition)*
- ChatMessage.Send  *(org-mode addition)*
- Team.ReadBasic.All  ★ admin consent  *(org-mode addition)*
- TeamsActivity.Send  *(org-mode addition)*

## `--preset all`

Preset Graph tools: **173** in personal mode, **343** in org mode.

### Personal mode (default)

- Calendars.ReadWrite
- Contacts.ReadWrite
- Files.ReadWrite
- Mail.ReadWrite
- Mail.Send
- MailboxSettings.Read
- MailboxSettings.ReadWrite
- Notes.Create
- Notes.Read
- Notes.ReadWrite
- Tasks.ReadWrite
- User.Read
- User.ReadWrite

### Org mode (`--org-mode`)

- Calendars.Read.Shared  ★ admin consent  *(org-mode addition)*
- Calendars.ReadWrite
- CallTranscripts.Read.All  ★ admin consent  *(org-mode addition)*
- Channel.Create  *(org-mode addition)*
- Channel.Delete.All  ★ admin consent  *(org-mode addition)*
- Channel.ReadBasic.All  ★ admin consent  *(org-mode addition)*
- ChannelMessage.Read.All  ★ admin consent  *(org-mode addition)*
- ChannelMessage.ReadWrite  *(org-mode addition)*
- ChannelMessage.Send  *(org-mode addition)*
- ChannelSettings.Read.All  ★ admin consent  *(org-mode addition)*
- ChannelSettings.ReadWrite.All  ★ admin consent  *(org-mode addition)*
- Chat.Create  *(org-mode addition)*
- Chat.ReadWrite  *(org-mode addition)*
- ChatMember.Read  *(org-mode addition)*
- ChatMessage.Read  *(org-mode addition)*
- ChatMessage.Send  *(org-mode addition)*
- Contacts.ReadWrite
- Directory.Read.All  ★ admin consent  *(org-mode addition)*
- Files.Read.All  ★ admin consent  *(org-mode addition)*
- Files.ReadWrite
- Group.Read.All  ★ admin consent  *(org-mode addition)*
- Group.ReadWrite.All  ★ admin consent  *(org-mode addition)*
- GroupMember.Read.All  ★ admin consent  *(org-mode addition)*
- GroupMember.ReadWrite.All  ★ admin consent  *(org-mode addition)*
- Mail.Read.Shared  ★ admin consent  *(org-mode addition)*
- Mail.ReadWrite
- Mail.ReadWrite.Shared  ★ admin consent  *(org-mode addition)*
- Mail.Send
- Mail.Send.Shared  ★ admin consent  *(org-mode addition)*
- MailboxSettings.Read
- MailboxSettings.ReadWrite
- Notes.Create
- Notes.Read
- Notes.ReadWrite
- OnlineMeetingArtifact.Read.All  ★ admin consent  *(org-mode addition)*
- OnlineMeetingRecording.Read.All  ★ admin consent  *(org-mode addition)*
- OnlineMeetings.Read  *(org-mode addition)*
- OnlineMeetings.ReadWrite  *(org-mode addition)*
- OnlineMeetingTranscript.Read.All  ★ admin consent  *(org-mode addition)*
- People.Read  *(org-mode addition)*
- Place.Read.All  ★ admin consent  *(org-mode addition)*
- Place.ReadWrite.All  ★ admin consent  *(org-mode addition)*
- Presence.Read  *(org-mode addition)*
- Presence.Read.All  ★ admin consent  *(org-mode addition)*
- Presence.ReadWrite  *(org-mode addition)*
- SensitivityLabel.Read  *(org-mode addition)*
- Sites.Manage.All  ★ admin consent  *(org-mode addition)*
- Sites.Read.All  ★ admin consent  *(org-mode addition)*
- Sites.ReadWrite.All  ★ admin consent  *(org-mode addition)*
- Tasks.ReadWrite
- Team.ReadBasic.All  ★ admin consent  *(org-mode addition)*
- TeamMember.Read.All  ★ admin consent  *(org-mode addition)*
- TeamMember.ReadWrite.All  ★ admin consent  *(org-mode addition)*
- TeamsActivity.Send  *(org-mode addition)*
- TeamsAppInstallation.ReadForUser  *(org-mode addition)*
- TeamsTab.Read.All  ★ admin consent  *(org-mode addition)*
- TeamworkCustomEmoji.Create  *(org-mode addition)*
- TeamworkCustomEmoji.Read  *(org-mode addition)*
- User.Read
- User.Read.All  ★ admin consent  *(org-mode addition)*
- User.ReadWrite
- VirtualEvent.Read  *(org-mode addition)*

---

## Notes for a minimal-privilege Azure AD app

1. **Start from the presets you actually need and take the union of their scopes.**
   Example: `--preset mail,calendar` needs
   `Calendars.ReadWrite`, `Mail.ReadWrite`, `Mail.Send`, `MailboxSettings.Read`, `MailboxSettings.ReadWrite`, `User.Read`.
2. **`Files.ReadWrite` covers more than you think.** The `files`, `excel`, `onedrive` and
   `personal` presets all run on `Files.ReadWrite` alone (Excel worksheets are just files).
   Prefer the narrower read scope pair `Files.Read` (+ `Files.ReadWrite` only if you must write).
3. **Some tools accept an OR-group of scopes.** SharePoint file/list tools work with either
   `Sites.Read.All`/`Sites.ReadWrite.All` **or** the granular `Sites.Selected` (per-site grants,
   evaluated against the signed-in user's own permissions). If your admin policy forbids
   tenant-wide `.All` scopes, use `--allowed-scopes` with `Sites.Selected` — tenant-wide
   discovery/search tools still need the broad scopes.
4. **Trim further with `--allowed-scopes`.** The server hides tools whose required scopes are
   not covered by the allowlist, so the effective surface shrinks with it:

   ```bash
   npx @softeria/ms-365-mcp-server --preset personal --allowed-scopes \
     "User.Read Mail.Read Mail.Send Calendars.ReadWrite Files.Read Contacts.Read Tasks.ReadWrite"
   ```

5. **Read-only deployments** (`--read-only`) drop write tools but keep the same scopes, so it
   narrows the tool surface, not the permission list.
6. **Admin consent** is needed once per scope per tenant; `.Shared` scopes (e.g.
   `Mail.Read.Shared`) are only meaningful in org mode with shared-mailbox access.

## Verify after registering

```bash
# confirm the app grants what a preset actually asks for
npx @softeria/ms-365-mcp-server --preset mail --list-permissions
npx @softeria/ms-365-mcp-server --org-mode --preset teams --list-permissions
```

`missingAllowedScopesForTools` non-empty means a tool was disabled because the allowlist
is missing a scope; `extraAllowedScopesNotUsedByTools` means you granted more than needed.

