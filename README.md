# BESCOM Feeder Digital Twin & Outage Operations Desk

> 🚀 **Live Demo:** [https://bescom.alwaysdata.net](https://bescom.alwaysdata.net/)  
> **Theme 04:** AI-Powered Smart Grid Digital Twin for Representative 11 kV Feeders  
> **Team:** Caffeine Addicts (Team 51) · CMR University  
> **Venue:** D, EGL-02 · BESCOM PowerHack 2026

---

## ⚡ Problem Context & Impact

In FY2023–24, Bangalore Electricity Supply Company Limited (BESCOM) incurred over **₹134.44 Crore** in repair and replacement expenditures across **36,035 failed distribution transformers (DTRs)**. Key contributing factors include:
- Peak evening residential demand combined with rapid, uncoordinated EV charging cluster adoption.
- Static, manual monitoring where overloads are only discovered after thermal tripping or physical transformer burnout.
- Lack of operator-in-the-loop simulation tools to verify whether shifting load across low-voltage tie links will breach downstream voltage drop limits (±6%).
- Fragmented consumer grievance reporting without geo-location verification against registered service areas.

---

## 🌐 Solution Overview

Our digital twin platform bridges real-time distribution transformer telemetry with an interactive switching decision support system and multi-role operations workflow:

```
                      11 kV Feeder Substation (BESCOM-F11-DEMO)
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            ▼                         ▼                         ▼
      [ DTR-01 ] 250 kVA        [ DTR-02 ] 200 kVA        [ DTR-03 ] 160 kVA
      Residential North         EV Charging Hub           IT Park Annex
      Commercial Retail         High-Density Apts         Mixed Residential
      Clinic & Civic            Small Workshops           Street & Metro Feed
            │                         │                         │
            └─── Tie Link 1-2 ────────┴─── Tie Link 2-3 ────────┘
                  (Cap: 60 kVA)             (Cap: 40 kVA)
                        │                         │
                        └─────── Tie Link 1-3 ────┘
                              (Cap: 50 kVA)
```

### Key Capabilities

1. **Feeder Digital Twin (11 kV / 415 V)**
   - Live SVG vector visualization showing dynamic power flow animations and real-time load distribution.
   - 90% pre-overload watchline alerts and visual pulse indicators for transformers exceeding nameplate rating.
   - Low-voltage drop calculation ensuring voltage remains within statutory ±6% limits.

2. **What-If Load Transfer Simulator**
   - Interactive tie-switch sliders to test moving load between neighbouring transformers before operating physical switchgear.
   - **"Suggest the best fix"** heuristic algorithm: finds optimal multi-tie transfer configurations minimizing peak transformer loading with minimal switching operations.
   - Decision audit log tracking operator approvals and rejections.

3. **Multi-Role Operations Portal**
   - **Consumer Portal:** Track monthly energy consumption (kWh), verify registered service location, submit low-voltage or power outage grievances, and authenticate via secure OTP challenges.
   - **Field Worker Portal:** View assigned dispatch work orders, submit real-time status updates (`IN_PROGRESS`, `BLOCKED`, `RESOLVED`), and log field visit notes.
   - **Grid Operator (Admin):** Triage customer grievances, dispatch active field workers, flag cases for human penalty review, manage worker credentials, and issue consumer advisory notices.

4. **15-Minute Load Forecasting**
   - 15-minute look-ahead demand prediction to warn operators of impending overloads during sudden load spikes or adverse weather events.

---

## 🏗️ Project Architecture

```
BESCOM_PowerHack_Caffeine_Addicts_2026/
├── backend.php                         # Front-controller router & static asset dispatcher
├── index.html                          # Primary modular single-page application
├── bescom-feeder-dashboard.html        # Standalone portable single-file bundle
├── .htaccess                           # Apache URL rewrite configuration
├── .gitignore                          # Git ignore rules for SQLite and temp files
├── config/
│   └── database.php                    # PDO SQLite database connection factory
├── src/
│   ├── Database/
│   │   └── Migrator.php                # Database schema migrations and seed fixtures
│   ├── Auth/
│   │   └── AuthService.php             # Session management, credential verify & OTP
│   ├── Services/
│   │   ├── SimulationService.php       # Tie-link transfer math & voltage drop checks
│   │   ├── TelemetryService.php        # 15-minute feeder readings & heuristic forecast
│   │   └── ComplaintService.php        # Grievance lifecycle & in-app notifications
│   └── Controllers/
│       ├── AuthController.php          # Login, OTP verification, me, logout
│       ├── CustomerController.php      # Customer overview, location verification, complaints
│       ├── AdminController.php         # Queue triage, worker management, notices, penalty review
│       ├── WorkerController.php        # Task board, progress notes, state transitions
│       └── TelemetryController.php     # Feeder telemetry and simulation endpoints
├── public/
│   ├── css/
│   │   └── style.css                   # Design tokens, theme custom properties & animations
│   └── js/
│       ├── state.js                    # Global application state & scenario definitions
│       ├── api.js                      # REST API client wrapper with error handling
│       ├── simulation.js               # Load transfer computation & auto-suggest algorithm
│       ├── charts.js                   # Chart.js integration for transformer & usage metrics
│       ├── topology.js                 # SVG feeder digital twin & flow rendering
│       ├── auth.js                     # Login modal, role switching & OTP verification
│       ├── portals/
│       │   ├── admin.js                # Operator triage queue & worker management
│       │   ├── customer.js             # Consumer dashboard, location check & complaint form
│       │   └── worker.js               # Field worker task cards & update actions
│       ├── dev-snippets.js             # Developer sample payloads & schema inspection
│       └── app.js                      # Main application bootstrapper & event routing
└── tests/
    └── smoke_test.py                   # Automated syntax, DOM reference, and PHP balance tests
```

---

## 🚀 Quickstart Guide

### Option 1: Live Cloud Application (Instant Access)

Access the live digital twin platform deployed at:  
👉 **[https://bescom.alwaysdata.net](https://bescom.alwaysdata.net/)**

---

### Option 2: Run Locally with PHP Built-in Server

Requires PHP 8.0+ with PDO SQLite extension enabled:

```bash
# Clone the repository
git clone git@github.com:DevireddyNehal/BESCOM_PowerHack_Caffeine_Addicts_2026.git
cd BESCOM_PowerHack_Caffeine_Addicts_2026

# Start the PHP server
php -S 127.0.0.1:8000 backend.php
```

Then open your browser at **`http://127.0.0.1:8000`**.

### Option 3: Standalone Static Preview

You can open `index.html` or `bescom-feeder-dashboard.html` directly in any modern browser to test the interactive simulation and UI components in client-side demonstration mode.

---

## 🔐 Demo Credentials

| Role | Username | Password | Notes |
|---|---|---|---|
| **Grid Operator (Admin)** | `admin` | `Demo123!` | Access to digital twin, operations desk, and worker dispatch |
| **Consumer** | `BES-10001` | `Demo123!` | Generates on-screen demo OTP (e.g. `123456`) to sign in |
| **Field Worker** | `worker01` | `Demo123!` | Access to field task board and progress updates |

---

## 📡 REST API Reference

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/health` | Server and database health status | Public |
| `POST` | `/api/auth/login` | Authenticate user; returns OTP challenge for consumers | Public |
| `POST` | `/api/auth/verify-otp` | Verify 6-digit OTP challenge | Pending session |
| `GET` | `/api/auth/me` | Fetch currently authenticated user session | Authenticated |
| `POST` | `/api/auth/logout` | Terminate session | Authenticated |
| `GET` | `/api/v1/telemetry/15min` | 15-minute feeder DTR ratings, active loads, and loading % | Public |
| `POST` | `/api/v1/scenario/simulate-transfer` | Simulate tie-line transfers, voltage drops, and overloads | Public |
| `POST` | `/api/v1/forecast/predict` | 15-minute look-ahead demand prediction heuristic | Public |
| `GET` | `/api/customer/overview` | Consumer monthly kWh history, complaints, notifications | Customer |
| `POST` | `/api/location/confirm` | Validate reported location against registered service area | Customer |
| `POST` | `/api/customer/complaints` | Submit new grievance to admin triage queue | Customer |
| `GET` | `/api/admin/overview` | Admin dashboard metrics, grievance queue, customer/worker list | Admin |
| `POST` | `/api/admin/workers` | Create new field worker credentials | Admin |
| `POST` | `/api/admin/workers/status` | Activate or deactivate worker access | Admin |
| `POST` | `/api/admin/complaints/action` | Assign worker, change complaint status, flag penalty | Admin |
| `POST` | `/api/admin/customers/notice` | Issue service review notice (SMS, email, call) | Admin |
| `POST` | `/api/admin/customers/request-removal` | Request human review for account removal | Admin |
| `GET` | `/api/worker/tasks` | Fetch tasks assigned to the authenticated worker | Worker |
| `POST` | `/api/worker/tasks/update` | Submit progress status (`IN_PROGRESS`, `BLOCKED`, `RESOLVED`) | Worker |

---

## 🧪 Verification & Testing

Run the automated smoke test suite:

```bash
python3 tests/smoke_test.py
```

Validates:
- JavaScript syntax across all 11 modules using `node --check`.
- 100% resolution of all 118 DOM element lookups in `index.html`.
- Strict typing and brace/parentheses balancing across all 12 PHP files.

---

## 👥 Team Caffeine Addicts (Team 51)

- **Zama** — Electrical grid modeling & load-transfer scenario testing
- **Nehal** — 15-minute demand forecasting & predictive modeling
- **Rajesh** — Full-stack application architecture, API services & responsive UI
- **Rohit** — Technical presentation, problem articulation & impact analysis
