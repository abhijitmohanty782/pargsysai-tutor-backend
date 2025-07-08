# feedback.py

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
import json

def run_chain(chain, input_data):
    result = chain.invoke(input_data)
    return getattr(result, "content", result)

def generate_semantic_feedback(
    master_text,
    student_text,
    feedback_matrix,
    final_equation_score,
    sbert_score,
    e5_score,
    final_score,
    model_name
):
    """
    Generates semantic feedback for a student based on their answer and comparison metrics.

    Args:
        master_text: The master answer text with equation descriptions.
        student_text: The student answer text with equation descriptions.
        feedback_matrix: The matrix containing feedback on unmatched equations.
        final_equation_score: The final equation matching score.
        sbert_score: The SBERT similarity score.
        e5_score: The E5 similarity score.
        final_score: The final calculated score out of 10.

    Returns:
        A dictionary containing the semantic feedback (score, verdict, comment, advice).
    """
    # 1. LLM instance
    llm = ChatGoogleGenerativeAI(model= model_name)

    # 2. Prompt Template
    semantic_feedback_prompt = ChatPromptTemplate.from_template(
        """
You are a helpful and constructive teacher. Based on the comparison below, generate feedback for a student in simple, encouraging language.

Give your output as a JSON object with:
- "score_out_of_10": just use the provided final score

- "verdict": a one-word summary (e.g., Outstanding, Excellent, Good, Fair, Not Good, Bad)

- "comment": a 1-2 sentence summary of the overall quality and completeness of the student's answer. 

- If there are unmatched equations, naturally mention that those specific equations should have been included as part of the mathematical explanation, and list them in plain text (comma-separated).

- "advice": a 1–2 sentence actionable suggestion tailored to the concept of the question.
  If there are unmatched equations, suggest focusing on those specific equations to improve.

Evaluation Context:

Master Answer:
{master}

Student Answer:
{student}

Unmatched Equations (if any):
{unmatched_equations}

Similarity Metrics:
- SBERT: {sbert}
- E5: {e5}
- Equation Match Score: {eq_score}
-

Final Score (use this directly): {final_score}

Return ONLY the JSON object. No preamble, no markdown formatting, no backticks, and no extra explanation.
"""
    )

    # 3. Chain
    semantic_chain = semantic_feedback_prompt | llm

    # 4. Inputs
    chain_input = {
        "master": master_text,
        "student": student_text,
        "unmatched_equations": json.dumps([eq["equation"] for eq in feedback_matrix]),
        "eq_score": round(final_equation_score, 4),
        "sbert": round(sbert_score, 4),
        "e5": round(e5_score, 4),
        "final_score": final_score
    }

    # 5. Run the chain and parse output
    response_text = run_chain(semantic_chain,chain_input)

    # 6. Pretty print the JSON response
    try:
        response_json = json.loads(response_text)
        print("\n✅ Final Semantic Feedback:\n")
        print(json.dumps(response_json, indent=2))
        return response_json
    except Exception as e:
        print("⚠️ Failed to parse LLM response as JSON.")
        print("Raw response:\n", response_text)
        return None
