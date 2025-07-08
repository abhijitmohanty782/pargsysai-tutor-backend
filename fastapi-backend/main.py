from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
from azure.cosmos import CosmosClient
from core.model import analyze_question_from_db  # ✅ Import from model.py

import os
import json


app = FastAPI(
    title="Answer Storage API",
    version="1.0",
    description="API to save master and student answers"
)

# Cosmos DB config
COSMOS_ENDPOINT = os.getenv("COSMOS_ENDPOINT")
COSMOS_KEY = os.getenv("COSMOS_KEY")
DATABASE_NAME = "tutor"
MASTER_CONTAINER_NAME = "masteranswer"
STUDENT_CONTAINER_NAME = "studentanswer"

cosmos_client = CosmosClient(COSMOS_ENDPOINT, COSMOS_KEY)
database = cosmos_client.get_database_client(DATABASE_NAME)
master_container = database.get_container_client(MASTER_CONTAINER_NAME)
student_container = database.get_container_client(STUDENT_CONTAINER_NAME)

# Request schema
class StudentAnswer(BaseModel):
    student_id: str
    answer_text: str

class AnswerUploadRequest(BaseModel):
    questionId: str
    master_answer: str
    student_answers: List[StudentAnswer]

# ✅ POST endpoint to store master + student answers
@app.post("/store-answers")
def store_answers(payload: AnswerUploadRequest):
    if not payload.master_answer.strip():
        raise HTTPException(status_code=400, detail="Master answer cannot be empty.")
    if not payload.student_answers:
        raise HTTPException(status_code=400, detail="Student answers list cannot be empty.")

    # ✅ Save full payload to file
    os.makedirs("storage", exist_ok=True)
    file_path = f"storage/{payload.questionId}.json"
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(payload.dict(), f, indent=2)

    return {
        "message": "Master and student answers saved successfully.",
        "questionId": payload.questionId,
        "student_count": len(payload.student_answers)
    }

# ✅ GET endpoint to analyze and generate feedback
@app.get("/analyze/{question_id}/{user_id}")
def run_analysis_from_db(question_id: str, user_id: str):
    try:
        result = analyze_question_from_db(
            question_id,
            user_id,
            master_container=master_container,
            student_container=student_container
        )
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# # ✅ GET endpoint to analyze and generate feedback
# @app.get("/analyze/{question_id}")
# def run_analysis(question_id: str):
#     try:
#         result = analyze_question(question_id)
#         if "error" in result:
#             raise HTTPException(status_code=404, detail=result["error"])
#         return result
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))
