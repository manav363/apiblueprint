# APIBlueprint — Visual API Design Studio

> A web-based, contract-first API design studio that lets developers visually design REST APIs and automatically generates a valid OpenAPI 3.0 specification in real time — no YAML required.

![APIBlueprint](https://img.shields.io/badge/version-1.0.0-00d4aa?style=flat-square) ![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react) ![Vite](https://img.shields.io/badge/Vite-5-646cff?style=flat-square&logo=vite) ![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## What is APIBlueprint?

Writing API specifications by hand means dealing with verbose YAML files, indentation errors, and constantly switching between the spec and the actual implementation. APIBlueprint solves this by replacing the text editor with a structured form-based studio.

You define your endpoints, parameters, request bodies, and responses through a clean UI — and the tool instantly produces a valid, standards-compliant OpenAPI 3.0 specification. Frontend and backend teams can work in parallel from day one because the spec acts as a shared contract before any backend code is written.

---

## Live Demo

```
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Pages & Features

### Dashboard `/`
- Grid of API project cards with endpoint count, description, and last modified time
- Create new projects and delete existing ones
- Stats row showing total projects, total endpoints, and active mock servers

### API Editor `/editor`
Three-panel layout:

**Left — Endpoint Sidebar**
- Endpoints organized by resource group (Users, Auth, etc.)
- Color-coded HTTP method badges (GET, POST, PUT, DELETE)
- Live mock server status indicator
- Add new endpoints with the + button

**Center — Form Editor**
Five tabs per endpoint:

| Tab | What it does |
|-----|-------------|
| Definition | Set method, path, operation ID, tag, summary, description |
| Parameters | Define path/query/header params with type and required flag |
| Request Body | Configure JSON payload for POST/PUT endpoints |
| Responses | Add status codes (200, 400, 404, etc.) with descriptions |
| Authentication | Set auth scheme (Bearer, API Key, OAuth) per endpoint |

**Right — Live YAML Spec**
- Real-time OpenAPI 3.0 YAML generated from form state
- Syntax highlighted (keys in blue, strings in green)
- Valid Spec indicator at the bottom
- Export SDK and Download buttons

### Schema Builder `/schema`
- Visual JSON schema editor with field tree
- Add nested objects and primitive types (string, integer, UUID, timestamp, URL)
- Required toggle per field
- Live JSON preview panel updating in real time
- Schema health indicator showing complexity score

### Export & SDKs `/export`
- Full OpenAPI YAML viewer with line numbers and syntax highlighting
- Copy and Download YAML/JSON
- SDK generator with Python and TypeScript output
- Package name configuration
- Mock server status panel with live request count and latency stats

### Monitoring `/monitoring`
- Four metric cards: Total Requests, Avg Latency, Error Rate, Uptime
- Requests/min bar chart with 12-minute window
- Latency bar chart with threshold highlighting
- Live request log table with method, path, status code (color-coded), and latency

### Documentation `/docs`
- Auto-generated reference docs from the same data entered in the editor
- Searchable endpoint list in the left sidebar
- Parameters table, curl example request, and response codes for each endpoint
- Zero manual writing — everything reflects the editor state automatically

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend framework | React 18 + Vite | Fast HMR, native ES modules, ideal for real-time editor |
| Routing | React Router v6 | SPA navigation without full page reloads |
| State management | React Context API | In-memory shared state across all pages |
| Styling | Plain CSS + CSS variables | Full control over the dark theme design system |
| Fonts | IBM Plex Mono + Sora | Monospace for code/paths, clean sans-serif for UI |
| Build tool | Vite | Sub-second builds, optimized production output |

---

## Project Structure

```
apiblueprint/
├── src/
│   ├── context/
│   │   └── AppContext.jsx       # Global state — projects, endpoints, active selections
│   ├── components/
│   │   ├── Sidebar.jsx          # Left navigation present on all pages
│   │   └── Topbar.jsx           # Top bar with tabs and search
│   ├── pages/
│   │   ├── Dashboard.jsx        # Home — project cards grid
│   │   ├── Editor.jsx           # Main 3-panel API editor
│   │   ├── SchemaBuilder.jsx    # Visual JSON schema editor
│   │   ├── ExportPage.jsx       # YAML viewer + SDK generator
│   │   ├── Monitoring.jsx       # Metrics + request log
│   │   └── Documentation.jsx   # Auto-generated API reference
│   ├── App.jsx                  # Route definitions
│   ├── main.jsx                 # React entry point
│   └── index.css               # Global CSS variables and base styles
├── index.html
├── vite.config.js
└── package.json
```

---

## Design System

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#000000` | Page background |
| `--surface` | `#0f0f0f` | Cards and panels |
| `--surface2` | `#161616` | Inputs and hover states |
| `--border` | `#242424` | Subtle dividers |
| `--accent` | `#00d4aa` | Primary teal — buttons, active states, indicators |
| `--text` | `#f0f0f0` | Primary text |
| `--text2` | `#a0a0a0` | Secondary labels |
| `--mono` | IBM Plex Mono | All paths, code, YAML |
| `--font` | Sora | All UI labels and body text |

Method badge colors follow REST conventions:
- `GET` → teal
- `POST` → yellow
- `PUT` → blue
- `DELETE` → red

---

## OpenAPI 3.0 Output Sample

The live YAML preview generates output like this from your form inputs:

```yaml
openapi: "3.0.0"
info:
  title: My API
  version: "1.0.0"
paths:
  /users/{id}:
    get:
      operationId: getUserById
      summary: Get user by ID
      tags:
        - Users
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
            format: int64
      responses:
        '200':
          description: Successful operation
        '404':
          description: User not found
```

---

## How to Run

**Prerequisites:** Node.js 18+ and npm

```bash
# 1. Clone or unzip the project
cd apiblueprint

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev

# 4. Build for production
npm run build
```

---

## Competitive Landscape

| Tool | Approach | Pricing |
|------|----------|---------|
| Postman | Request-centric, tab-based | Freemium ($12+/user) |
| SwaggerHub | Spec-centric, enterprise | Paid ($30+/user) |
| Stoplight | Visual modeling, lifecycle | Paid ($56+/user) |
| **APIBlueprint** | **Form-driven, studio** | **Open Source / Free** |
| Bruno | Git-integrated, local | Paid ($6+/user) |

APIBlueprint sits in the gap between Postman (too request-focused) and Stoplight (too enterprise) — a lightweight, visual, design-first studio built for individual developers and agile teams.

---

## Roadmap (Full Implementation)

- [ ] Backend — FastAPI + PostgreSQL to persist projects across sessions
- [ ] Real mock server — Express.js server that reads the spec and returns example responses
- [ ] SDK generation — Python and TypeScript client code from the OpenAPI spec
- [ ] OpenAPI import — paste an existing YAML and populate the editor automatically
- [ ] Spec validation — real-time linting with Spectral for structural errors
- [ ] Team collaboration — share projects with other users via link
- [ ] Version history — track changes to the spec over time

---

## Academic Context

This project was developed as a college capstone submission demonstrating:

- **Frontend architecture** — React component design, context-based state management, client-side routing
- **API standards knowledge** — OpenAPI 3.0 specification structure, HTTP semantics, REST resource modeling
- **Developer tooling** — Understanding of the API design lifecycle from contract to documentation to SDK
- **UX for developers** — Information-dense dark theme UI, monospace typography, real-time feedback patterns

---

## Author

**Manav**  
College Capstone Project — 2026  
Built with React + Vite

---

> *"APIBlueprint eliminates the manual YAML authoring step in API design — you fill out forms, and it generates a standards-compliant OpenAPI 3.0 specification in real time, along with documentation, a mock server status panel, and SDK code, so frontend and backend teams can work in parallel from day one."*