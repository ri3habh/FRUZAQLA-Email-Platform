from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine
from routers import admin, claims, collaboration, compliance, projects

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Solstice Demo API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router)
app.include_router(projects.router)
app.include_router(claims.router)
app.include_router(compliance.router)
app.include_router(collaboration.router)


@app.get("/health")
def health():
    return {"status": "ok"}
