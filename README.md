Backend prerequisites: Python 3.9+ and pip.
Frontend prerequisites: Node.js 16+ and npm.

Backend setup:
1. Open a terminal in the project root.
2. Run: cd server
3. Run: pip install -r requirements.txt
4. Ensure database environment variables are set in server directory (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD).

Frontend setup:
1. Open a second terminal in the project root.
2. Run: cd client
3. Run: npm install

Supabase auth setup:
1. In client environment varaibles, set:
   - `VITE_SUPABASE_URL=<your-supabase-project-url>`
   - `VITE_SUPABASE_KEY=<your-supabase-anon-key>`
2. Enable Google and GitHub authentication providers in Supabase

Running the app
1. Start backend: from server/, run uvicorn main:app --reload --port 8000
2. Start frontend: from client/, run npm run dev
3. Open the frontend URL shown by Vite (usually http://localhost:5173)
4. Backend API is available at http://localhost:8000

Important implementation details
1. Backend framework is FastAPI; routes are organized under server/routes and registered in server/main.py.
2. Database access is centralized in server/database.py using psycopg2 with RealDictCursor.
3. The backend supports both years (multi-select) and year (legacy single value) query params via server/routes/sql_common.py.
4. Fare-evasion queries dynamically resolve schema/table/column variants to handle source naming differences.
5. Frontend is React + Vite; routing and auth gating are handled in client/src/App.jsx.
6. Supabase auth is optional at runtime; when env vars are missing, the app avoids auth API calls.
7. Several endpoints query pre-aggregated materialized views for performance (for example monthly_ridership_mv and station_summary_mv).
