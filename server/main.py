import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import stations, fare_evasion, boroughs, trends, map as map_routes, metadata, arrests, auth

app = FastAPI(title="NYC Subway Fare Evasion Analytics API", version="1.0.0")

_ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
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
app.include_router(arrests, prefix="/arrests", tags=["arrests"])
app.include_router(auth, prefix="/auth", tags=["auth"])


@app.get("/")
def root():
    return {"message": "NYC Subway Fare Evasion Analytics API", "status": "running"}


@app.get("/health")
def health():
    return {"status": "ok"}
