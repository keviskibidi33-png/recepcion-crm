from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from router import router

from fastapi.responses import JSONResponse
from exceptions import DuplicateRecepcionError, BaseAppException

app = FastAPI(title="Migration Reception API")

@app.exception_handler(DuplicateRecepcionError)
async def duplicate_recepcion_exception_handler(request, exc):
    return JSONResponse(
        status_code=400,
        content={"message": str(exc)},
    )

@app.exception_handler(BaseAppException)
async def base_app_exception_handler(request, exc):
    return JSONResponse(
        status_code=400,
        content={"message": exc.message},
    )



app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost:3002", 
        "https://crm.geofal.com.pe", 
        "https://recepcion.geofal.com.pe"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    import traceback
    error_detail = traceback.format_exc()
    print(f"ERROR: {error_detail}")
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error", "detail": str(exc)}
    )


app.include_router(router)

@app.get("/health")
async def health_check():
    return {"status": "ok", "module": "reception-migration"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
