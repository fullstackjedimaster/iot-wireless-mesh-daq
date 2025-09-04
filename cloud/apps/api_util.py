# ✅ Example of usage in a FastAPI route
from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Request

API_TOKEN = "ArrayApp:Token_Teal"

async def proper_API_call_required(request: Request):
    """
    Dependency function that ensures the API call is properly formatted.
    """
    request_url = str(request.url)

    # ✅ Ensure request method is POST
    if request.method != "POST":
        raise HTTPException(status_code=405, detail=f"API call must be a POST: {request_url}")

    # ✅ Extract form data (FastAPI requires `await` for form)
    form = await request.form()

    # ✅ Ensure API token is present
    if "API_TOKEN" not in form:
        raise HTTPException(status_code=400, detail=f"API call must have an API_TOKEN: {request_url}")

    # ✅ Validate API token
    token = form["API_TOKEN"]
    if token != API_TOKEN:
        raise HTTPException(status_code=403, detail=f"API call supplied wrong API_TOKEN: {request_url}")

    return True


router = APIRouter()

@router.post("/secure-api")
async def secure_endpoint(request: Request, valid: bool = Depends(proper_API_call_required)):
    return {"message": "Secure API accessed successfully!"}
