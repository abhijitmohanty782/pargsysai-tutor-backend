# scorers.py

from sentence_transformers import util
import torch
import torch.nn.functional as F


def calculate_sbert_similarity(master_text, student_text, sbert_model):
    sbert_master = sbert_model.encode(master_text, convert_to_tensor=True)
    sbert_student = sbert_model.encode(student_text, convert_to_tensor=True)
    return util.cos_sim(sbert_master, sbert_student).item()

def calculate_e5_similarity(master_text, student_text, tokenizer, model):
    """
    Calculates the E5 cosine similarity between two texts.
    """

    def get_e5_embedding(text, tokenizer, model):
        input_ids = tokenizer(f"query: {text}", return_tensors="pt", padding=True, truncation=True)
        with torch.no_grad():
            model_output = model(**input_ids)
        embeddings = model_output.last_hidden_state[:, 0]
        return F.normalize(embeddings, p=2, dim=1)

    e5_master = get_e5_embedding(master_text, tokenizer, model)
    e5_student = get_e5_embedding(student_text, tokenizer, model)
    return F.cosine_similarity(e5_master, e5_student).item()

def calculate_final_score(equation_score, sbert_score, e5_score):
    # Weights for each component
    weight_equation = 0.5
    weight_sbert = 0.25
    weight_e5 = 0.25

    # Weighted average and scale to 10
    final_score = (
        weight_equation * equation_score +
        weight_sbert * sbert_score +
        weight_e5 * e5_score
    ) * 10

    return round(final_score, 1)  # Round to 1 decimal

