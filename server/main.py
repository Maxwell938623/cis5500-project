from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import stations, fare_evasion, boroughs, trends, map as map_routes, metadata

app = FastAPI(title="NYC Subway Fare Evasion Analytics API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stations, prefix="/stations", tags=["stations"])
app.include_router(fare_evasion, prefix="/fare-evasion", tags=["fare-evasion"])
app.include_router(boroughs, prefix="/boroughs", tags=["boroughs"])
app.include_router(trends, prefix="/trends", tags=["trends"])
app.include_router(map_routes, prefix="/map", tags=["map"])
app.include_router(metadata, prefix="/metadata", tags=["metadata"])


@app.get("/")
def root():
    return {"message": "NYC Subway Fare Evasion Analytics API", "status": "running"}


@app.get("/health")
def health():
    return {"status": "ok"}
