# n8n-nodes-sinergiacrm

A generic n8n node to operate with any SinergiaCRM (7.x+) module via the official JSON API.

Supports CRUD operations, dynamic module and field discovery (including custom fields), advanced filtering, pagination, and relationship retrieval.

---

## Features

- **Full CRUD** – Create, read, update, and delete any SinergiaCRM module
- **Dynamic discovery** – Auto-lists modules and fields, including custom fields
- **Advanced filtering** – Filter records using operators, custom fields, pagination
- **Relationship handling** – Retrieve, link, and unlink related records from any entity
- **Polling trigger** – React to new or updated records without touching the CRM instance
- **AI agent tool** – Use the main node as a tool from an n8n AI Agent
- **OAuth2 authentication** – Native SinergiaCRM client credentials flow
- **Robust error handling** – Clear errors and maintainable structure

---

## Installation

**Recommended:** install from the n8n UI under **Settings → Community Nodes**, entering the package name `n8n-nodes-sinergiacrm`.

**Self-hosted via CLI:** install it into your n8n instance:

```bash
npm install n8n-nodes-sinergiacrm
```

Then restart n8n. See the [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/installation/) for details.

---

## Usage

### 1. Credentials

- Create credentials in n8n of type **SinergiaCRM API**
- Fill in your SinergiaCRM domain, Client ID, and Client Secret  
  *(see SinergiaCRM → Admin → OAuth2 Clients)*

### 2. Node Configuration

- **Module:** Auto-discovered list from your API
- **Operation:** Choose from Get All, Get One, Create, Update, Delete, Get Relationships, Link Record, Unlink Record
- **Data mode:** Define Create/Update payloads field by field, or with raw JSON
- **Parameters:** Filters, IDs, pagination, or JSON payloads depending on operation

### 3. Example – Create a Contact

Input data:
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email1": "john.doe@example.com"
}
```

### 4. Polling Trigger

The **SinergiaCRM Trigger** node polls the selected modules and emits one item per new or updated record. Events are limited to `created` and `updated` (deletion detection is not supported). Cadence is configurable: every poll, every N hours/days, or a 5-field cron expression.

### 5. AI Agent Tool

The main SinergiaCRM node can be used as a tool by n8n's **AI Agent**. Community packages are only exposed as tools when the instance is started with:

```bash
N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true
```

Without that environment variable the node does not appear as a tool (the trigger node is never usable as a tool).

#### Letting the model fill in the data

The node ships with `$fromAI()` defaults for its dynamic parameters, so the model controls them out of the box:

- **`data`** – the record payload (Create / Update, Raw JSON mode)
- **`id`** – the record ID (Get One, Update, Delete, Get Relationships)
- **`limit`** – the page size (Get All with Return All disabled)

`Module` and `Operation` stay fixed on the node: pin one module/operation per workflow (e.g. `Contacts` + `Create`), and the agent supplies `data` on each call. You can also enable/disable `$fromAI()` per field with the **"Defined automatically by the model"** button in the node editor.

#### Using it through an MCP server

Because the node is `usableAsTool`, n8n's **MCP Server** trigger exposes it automatically to any MCP client. Connect the node as a tool in an MCP Server workflow, point your client at the server's URL, and the model can call the same operations directly (e.g. `Get All` exposes a `limit` parameter, `Create` exposes a required `data` payload).

---

## Supported Operations

| Operation         | Description                                   |
|------------------|-----------------------------------------------|
| Get All          | Fetch records with optional filters & paging  |
| Get One          | Retrieve a single record by ID                |
| Create           | Add a new record (field mode or JSON payload) |
| Update           | Modify a record (field mode or JSON payload)  |
| Delete           | Remove a record by ID                         |
| Get Relationships| Fetch related records of a module by ID       |
| Link Record      | Link an existing record to another            |
| Unlink Record    | Break a link without deleting either record   |

---

## Requirements

- n8n 1.x or newer
- SinergiaCRM 7.x+ with API and OAuth2 enabled
- SinergiaCRM **≥ 7.11.4** is required for the **Unlink Record** operation (DELETE relationship endpoint)
- All modules and fields are fetched dynamically
- For 1:N relations, set the "parent" ID on the child (SinergiaCRM logic)
- Tested against SinergiaCRM v7+ JSON API

---

## Troubleshooting

- `access_token` missing → Check credentials or OAuth2 setup
- `405 Method Not Allowed` → PATCH may not be enabled in your SinergiaCRM
- API and validation errors are thrown as n8n node errors. To keep the workflow running after an error, enable **Continue On Fail** on the node.

---

## Contributing

Contributions welcome!  
Feel free to open issues or PRs.

---

## License

MIT

---

**Maintainer:** Javier Quilez Cabello / [tecnologiasolidaria.org](https://tecnologiasolidaria.org)  
**Support:** [SinergiaCRM Forums](https://community.sinergiacrm.com/)  
**Source:** [GitHub](https://github.com/tecnologiasolidaria/n8n-nodes-sinergiacrm)  
**Docs:** [SinergiaCRM JSON API](https://docs.sinergiacrm.com/developer/api/developer-setup-guide/json-api/)
