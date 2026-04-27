# Industrial 3D Solution — Inventory & POS System

## Quick Start

### Prerequisites
- **Node.js** v18+
- **PostgreSQL** v14+ (running locally or remote)

### 1. Configure Database
Edit `server/.env`:
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/industrial3d_pos
JWT_SECRET=change_this_to_a_long_random_string
```

### 2. Create Database & Tables
```
Double-click: SETUP_DATABASE.bat
```
Or manually:
```bash
# Create database
psql -U postgres -c "CREATE DATABASE industrial3d_pos;"

# Initialize schema + sample data
cd server
node config/initDb.js
```

### 3. Start Application
```
Double-click: START.bat
```
Or manually (two terminals):
```bash
# Terminal 1 — Backend
cd server && node server.js

# Terminal 2 — Frontend  
cd client && npm run dev
```

### 4. Open in Browser
- URL: **http://localhost:5173**
- Login: **admin@industrial.com.bd**
- Password: **admin123**

---

## Modules
| # | Module | Description |
|---|--------|-------------|
| 1 | Dashboard | KPI cards, recent transactions, low stock alerts, AI panel |
| 2 | Point of Sale | Sales, preorders, invoices, VAT, payment methods |
| 3 | Preorders | Advance tracking, due collection, delivery management |
| 4 | Inventory | Product CRUD, stock adjustments, margin analysis |
| 5 | Customers | Customer profiles, purchase history, credit accounts |
| 6 | Suppliers & POs | Supplier management, import orders, landed cost calc |
| 7 | Group Buys | Participant tracking, progress bars, order placement |
| 8 | Reports | Sales, VAT, P&L, inventory valuation, slow-moving stock |
| 9 | Settings | Full customization: business, invoice, tax, payment, AI |

## AI Assistant Setup
1. Go to **Settings → AI Assistant**
2. Select provider: **Gemini** (free), Anthropic, or OpenAI
3. Enter your API key
4. Get a free Gemini key at: https://aistudio.google.com/apikey

## User Roles
| Role | Access |
|------|--------|
| Admin | Full access to everything |
| Manager | All modules, approve discounts, no settings |
| Salesperson | POS, preorders, customer view |
| Inventory | Inventory, suppliers, purchase orders |
| Accountant | Reports and VAT (read-only) |

## Tech Stack
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Express.js (ES Modules)
- **Database**: PostgreSQL
- **Auth**: JWT (24h expiry)
- **AI**: Gemini / Claude / OpenAI (configurable)
- **PDF**: jsPDF + jspdf-autotable
- **Charts**: Recharts

## Currency Format
All amounts displayed in Bangladeshi Taka: **৳1,85,000** (Indian number system)
