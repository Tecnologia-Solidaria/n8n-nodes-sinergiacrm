# n8n-nodes-sinergiacrm

A generic n8n node to operate with any SinergiaCRM (SuiteCRM 7.x+) module via the official JSON API.

Supports CRUD operations, dynamic module and field discovery (including custom fields), advanced filtering, pagination, and relationship retrieval.

---

## Features

- **Full CRUD** – Create, read, update, and delete any SuiteCRM module
- **Dynamic discovery** – Auto-lists modules and fields, including custom fields
- **Advanced filtering** – Filter records using operators, custom fields, pagination
- **Relationship handling** – Retrieve related records from any entity
- **OAuth2 authentication** – Native SuiteCRM client credentials flow
- **Robust error handling** – Clear errors and maintainable structure

---

## Installation

```bash
pnpm add n8n-nodes-sinergiacrm
```

Or with npm:

```bash
npm install n8n-nodes-sinergiacrm
```

Add to your instance following [n8n's custom node guide](https://docs.n8n.io/integrations/creating-nodes/code/create-node/).

---

## Usage

### 1. Credentials

- Create credentials in n8n of type **SinergiaCRM API**
- Fill in your SuiteCRM domain, Client ID, and Client Secret  
  *(see SuiteCRM → Admin → OAuth2 Clients)*

### 2. Node Configuration

- **Module:** Auto-discovered list from your API
- **Operation:** Choose from Get All, Get One, Create, Update, Delete, Get Relationships
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

---

## Supported Operations

| Operation         | Description                                   |
|------------------|-----------------------------------------------|
| Get All          | Fetch records with optional filters & paging  |
| Get One          | Retrieve a single record by ID                |
| Create           | Add a new record (JSON fields)                |
| Update           | Modify a record (PATCH with JSON)             |
| Delete           | Remove a record by ID                         |
| Get Relationships| Fetch related records of a module by ID       |

---

## Requirements

- SuiteCRM 7.x+ with API and OAuth2 enabled
- All modules and fields are fetched dynamically
- For 1:N relations, set the "parent" ID on the child (SuiteCRM logic)
- Tested against SuiteCRM v7+ JSON API

---

## Troubleshooting

- `access_token` missing → Check credentials or OAuth2 setup
- `405 Method Not Allowed` → PATCH may not be enabled in your SuiteCRM
- Any API error is returned as node output for transparency

---

## Contributing

Contributions welcome!  
Feel free to open issues or PRs.

---

## License

MIT

---

**Maintainer:** Javier Quilez Cabello / [tecnologiasolidaria.org](https://tecnologiasolidaria.org)  
**Support:** [SuiteCRM Forums](https://community.suitecrm.com/)  
**Source:** [GitHub](https://github.com/tecnologiasolidaria/n8n-nodes-sinergiacrm)  
**Docs:** [SuiteCRM JSON API](https://docs.suitecrm.com/developer/api/developer-setup-guide/json-api/)
