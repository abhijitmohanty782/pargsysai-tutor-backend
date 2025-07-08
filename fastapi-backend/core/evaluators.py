# evaluators.py

from langchain_core.documents import Document
import numpy as np

def score_equations(master_extractions, student_extractions, embedding_model):
    """
    Scores student equations against master equations using embedding similarity.

    Args:
        master_extractions: A list of dictionaries representing master equations.
        student_extractions: A list of dictionaries representing student equations.
        embedding_model: The embedding model to use for similarity comparison.

    Returns:
        A dictionary containing the final equation score, total unique master equations,
        and a feedback matrix.
    """
    # Set to store unique master equations
    master_unique_extractions = set()
    print("Master Extractions:")
    for item in master_extractions:
        master_unique_extractions.add(item['equation'])
        print(f" - Equation: {item['equation']}")
        print(f"   Description: {item['description']}\n")

    print("Student Extractions:")
    for item in student_extractions:
        print(f" - Equation: {item['equation']}")
        print(f"   Description: {item['description']}\n")

    # Combine raw equation and description for better matching
    master_docs = [
        Document(
            page_content=f"{eq['equation']}. Description: {eq['description']}",
            metadata={"equation": eq['equation'], "description": eq['description']}
        )
        for eq in master_extractions
    ]

    score = 0
    matched_equations = set()
    total = len(master_unique_extractions)
    feedback_matrix = []

    print("\n🔍 Equation Matching Details (Best Match Strategy):")

    for master_eq in master_extractions:
        master_query = f"{master_eq['equation']}. Description: {master_eq['description']}"
        master_vec = embedding_model.embed_query(master_query)

        best_sim_score = 0
        best_student_eq = None

        for student_eq in student_extractions:
            student_text = f"{student_eq['equation']}. Description: {student_eq['description']}"
            student_vec = embedding_model.embed_query(student_text)
            sim_score = np.dot(master_vec, student_vec) # Use dot product for cosine similarity

            if sim_score > best_sim_score:
                best_sim_score = sim_score
                best_student_eq = student_eq

        if best_sim_score >= 0.90:
            matched_equations.add(master_eq['equation'])
            print(f"\n✅ Best Match:")
            print(f"  Master Equation   : {master_eq['equation']}")
            print(f"  Student Equation  : {best_student_eq['equation']}")
            print(f"  Similarity Score  : {best_sim_score:.4f}")
        else:
            print(f"\n❌ Not Matched:")
            print(f"  Master Equation   : {master_eq['equation']}")
            feedback_matrix.append({
                "equation": master_eq['equation'],
                "description": master_eq['description'],
                "best_similarity": round(best_sim_score, 4),
                "closest_match": best_student_eq['equation'] if best_student_eq else None
            })

    final_equation_score = len(matched_equations) / total if total > 0 else 0

    return {
        "score": len(matched_equations),
        "total_master_equations": total,
        "final_equation_score": final_equation_score,
        "feedback_matrix": feedback_matrix
    }
