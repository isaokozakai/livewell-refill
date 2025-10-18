# Prescription Refill Tracker (Livewell Take Home)

A full-stack medication management app that tracks prescriptions, calculates refill dates, and monitors adherence.

**Tech Stack:** Next.js 15 (App Router) + React 19 + TypeScript + File-based storage

## Quick Start

```bash
# Install dependencies
yarn

# Run development server
yarn dev
```

Open [http://localhost:3000](http://localhost:3000)

## Testing

```bash
yarn test              # Run all tests
yarn test:watch        # Watch mode
yarn test:coverage     # Generate coverage report
```

- **Unit tests** ([`calc.test.ts`](src/lib/__tests__/calc.test.ts)) - Core calculation logic
- **Integration tests** ([`medications.test.ts`](src/app/api/__tests__/medications.test.ts)) - API validation and CRUD operations

## Features

### Core Functionality
- ✅ Add/edit/delete medications with full validation
- ✅ Automatic calculations: remaining doses, days left, next refill date
- ✅ Smart status classification: on_track, running_low (≤7 days), overdue
- ✅ Visual progress bars showing medication remaining
- ✅ Mark doses as taken/missed with adherence percentage tracking
- ✅ Alerts banner for medications needing refill

### Bonus Features
- 🔍 **Medication search** - RxNorm API integration with autocomplete
- 📄 **Export to PDF** - Professional reports via Puppeteer
- 📊 **Export to CSV** - Spreadsheet-ready with formula injection protection
- 📱 **Responsive design** - Mobile, tablet, and desktop layouts
- 🌙 **Dark mode** - Automatic theme based on system preferences

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/medications` | List all medications with computed fields |
| POST | `/api/medications` | Create medication |
| PUT | `/api/medications` | Update medication |
| DELETE | `/api/medications?id=...` | Delete medication |
| PATCH | `/api/medications` | Add adherence event (mark taken/missed) |
| GET | `/api/alerts` | Get medications needing refill |
| GET | `/api/search?q=...` | Search medications (RxNorm) |
| GET | `/api/export/csv` | Export as CSV |
| GET | `/api/export/pdf` | Export as PDF |

### Example: Create Medication

```bash
curl -X POST http://localhost:3000/api/medications \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Aspirin",
    "dosage": "81 mg",
    "frequencyPerDay": 1,
    "startDate": "2025-01-01",
    "quantityReceived": 30,
    "daysSupply": 30
  }'
```

## Architecture

```
src/
├── app/
│   ├── api/              # REST API endpoints
│   ├── page.tsx          # Main UI component
│   └── page.module.css   # Responsive styles with dark mode
├── lib/
│   ├── types.ts          # TypeScript type definitions
│   ├── calc.ts           # Pure calculation functions
│   └── storage.ts        # File-based persistence
└── __tests__/            # Unit and integration tests
```

**Key Implementation Details:**
- **Type-safe** - Full TypeScript coverage with strict mode
- **Secure** - Input validation, CSV injection protection, cryptographically secure IDs
- **Optimized** - N+1 query elimination, localStorage caching

## Data Storage

Medications and adherence events are stored in `data/db.json`. The file is created automatically on first run.

Example structure:
```json
{
  "medications": [
    {
      "id": "med_lxz8k9q_a3f7b2c8d1e4f6a9",
      "name": "Aspirin",
      "dosage": "81 mg",
      "frequencyPerDay": 1,
      "startDate": "2025-01-01",
      "quantityReceived": 30,
      "daysSupply": 30,
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-01-15T10:00:00.000Z"
    }
  ],
  "adherenceEvents": [
    {
      "id": "adh_lxz8k9r_b4e8c3d2f5a7b1c9",
      "medicationId": "med_lxz8k9q_a3f7b2c8d1e4f6a9",
      "date": "2025-01-15",
      "doses": 1,
      "status": "taken"
    }
  ]
}
```

## Production Build

```bash
yarn build    # Build with Turbopack
yarn start    # Start production server
```

## Design Decisions

- **File-based storage** - Simple deployment, no database setup required (per assignment)
- **Server-side calculations** - Ensures consistency, reduces client load
- **Pure functions** - Calculation logic is testable and predictable
- **Responsive-first** - Mobile, tablet, desktop breakpoints with CSS Grid
