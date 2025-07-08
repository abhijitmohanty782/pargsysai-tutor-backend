# extractors.py
import re
import json

from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

# Converts LLM output (either a plain string or an AIMessage object) into a clean JSON-ready string.
# Removes code block markers like ```json and backticks to safely parse the content.
def run_chain(chain, input_data):
    result = chain.invoke(input_data)
    return getattr(result, "content", result)

def clean_llm_output(output) -> str:
    if hasattr(output, "content"):
        output = output.content
    return output.strip().removeprefix("```json").removesuffix("```").strip("`").strip()


def extract_equations(master_answer: str, student_answer: str, model_name: str = "gemini-1.5-flash"):
    # Instantiate your LLM
    llm = ChatGoogleGenerativeAI(model=model_name)

    # Create a prompt template to extract equations and descriptions
    prompt = ChatPromptTemplate.from_template(
        """
Extract all mathematical equations from the following answer.
For each equation, return a JSON object with:
  - \"equation\": the exact equation text
  - \"description\": a natural-language verbalization of that equation
Return ONLY a JSON array of these objects.
If no equations are found, return an empty JSON array: []

Do NOT include any markdown formatting, backticks, or extra text before or after the JSON array.

Answer text:
{input}
"""
    )

    # Build the extraction chain
    extract_chain = prompt | llm

    # Run extraction on master and student answers
    master_json_str = run_chain(extract_chain,master_answer)
    student_json_str = run_chain(extract_chain,student_answer)
    
    # Remove markdown/code block formatting
    master_json_str = clean_llm_output(master_json_str)
    student_json_str = clean_llm_output(student_json_str)

    # Debug logs (optional)
    print("Master JSON output:", master_json_str)
    print("Student JSON output:", student_json_str)

    try:
        # Log raw output for debugging
        print("\n🔍 Raw Gemini Outputs")
        print("Master JSON Raw:", repr(master_json_str))
        print("Student JSON Raw:", repr(student_json_str))

        # Parse master answer
        if not master_json_str.strip():
            raise ValueError("LLM returned empty output for master answer.")
        else:
            master_extractions = json.loads(master_json_str, strict=False)

        # Parse student answer (with fallback if empty)
        if not student_json_str.strip():
            print("⚠️ Student answer has no extractable equations. Using empty list.")
            student_extractions = []
        else:
            student_extractions = json.loads(student_json_str, strict=False)

    except json.JSONDecodeError as json_err:
        raise ValueError(f"❌ JSON parsing failed.\nRaw student output:\n{student_json_str}\n\nError: {json_err}")
    except Exception as e:
        raise ValueError(f"❌ Unexpected error during parsing: {e}")

    return {
        "master_extractions": master_extractions,
        "student_extractions": student_extractions
    }
    
def normalize_equation(eq: str):
    eq = eq.replace("²", "^2")
    eq = re.sub(r"\s+", "", eq)  # remove spaces for better structural comparison
    return eq

def process_extractions(extractions, normalize_func):
    """
    Processes a list of equation extractions by normalizing equations and
    adding a 'raw_equation' key.

    Args:
        extractions: A list of dictionaries, where each dictionary
                     represents an extracted equation.
        normalize_func: The function to use for normalizing equations.

    Returns:
        None. The extractions list is modified in-place.
    """

    # Check if the parsed output is a list before attempting to iterate
    if not isinstance(extractions, list):
        raise ValueError("Input extractions is not a list:")

    for eq in extractions:
        # Check if 'equation' key exists before accessing
        if 'equation' in eq:
            eq['raw_equation'] = eq['equation']
            eq['equation'] = normalize_func(eq['equation'])
        else:
            print(f"Warning: 'equation' key not found in extraction: {eq}")