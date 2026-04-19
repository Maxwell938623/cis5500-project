# NYC Subway Analytics , CIS 5500 Project

A full-stack web application for analyzing NYC subway ridership patterns and estimated fare evasion data.

## Architecture

```
cis5500-project/
  server/        FastAPI Python backend (connects to AWS RDS PostgreSQL)
  client/        React frontend (Create React App structure)
```

## Backend Setup

### Prerequisites
- Python 3.9+
- pip

### Install & Run

```bash
cd server
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### Environment Variables

The `.env` file in `server/` is pre-configured with the AWS RDS credentials. To override, edit `server/.env`:

```
DB_HOST=...
DB_PORT=5432
DB_NAME=postgres
DB_USER=...
DB_PASSWORD=...
```

### API Endpoints

| Endpoint | Description |
|---|---|
| `GET /stations/busiest` | Top stations by total ridership |
| `GET /stations/risk-profile` | Station fare-risk profile (reduced-fare %) |
| `GET /stations/search` | Station autocomplete search |
| `GET /stations/{id}` | Station detail |
| `GET /fare-evasion/quarterly` | Quarterly evasion rate with margin of error |
| `GET /fare-evasion/revenue-loss` | Estimated revenue lost per quarter |
| `GET /boroughs/ridership-by-year` | Borough ridership over time |
| `GET /boroughs/ada-stations` | ADA-accessible station counts |
| `GET /boroughs/payment-share` | Payment method breakdown by borough |
| `GET /boroughs/evasion-intensity` | Estimated evasion intensity by borough |
| `GET /trends/ridership-vs-evasion` | Annual ridership vs evasion trends |
| `GET /map/top-non-cbd-stations` | Top non-CBD stations with coordinates |
| `GET /metadata/boroughs` | Available boroughs |
| `GET /metadata/lines` | Available subway lines |
| `GET /metadata/payment-methods` | Payment method categories |
| `GET /metadata/fare-categories` | Fare class categories |

## Frontend Setup

### Prerequisites
- Node.js 16+
- npm

### Install & Run

```bash
cd client
npm install
npm start
```

The app will open at `http://localhost:3000`. It proxies API requests to `http://localhost:8000`.

### Pages

| Page | Route | Description |
|---|---|---|
| Historical Trends | `/trends` | Annual ridership vs evasion with YoY change |
| Borough Equity | `/borough-equity` | Ridership, ADA stations, and evasion intensity by borough |
| Financial Impact | `/financial-impact` | Quarterly evasion rates, revenue loss estimates, payment share |
| Station Index | `/station-index` | Fare-risk profile table with station search and detail |
| Geo Map | `/map` | Leaflet map of top non-CBD stations by borough |

## Database Schema

- **fareevasionstats** , `(year, quarter, fare_evasion, margin_of_error)` , MTA quarterly survey data
- **stationcoords** , Station metadata with geographic coordinates and ADA/CBD flags
- **ridership** , Tap-in ridership records with payment method and fare class

## Tech Stack

- **Backend**: FastAPI, psycopg2, Python 3.9+
- **Frontend**: React 18, React Router 6, Recharts 2, React-Leaflet 4, Axios
- **Database**: PostgreSQL on AWS RDS
- **Map tiles**: CartoDB Dark Matter (OpenStreetMap data)
