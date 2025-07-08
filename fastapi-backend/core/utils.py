# utils.py

import re

def replace_equations_with_descriptions(text, equations):
    for eq in equations:
        original_eq = eq.get('raw_equation') or eq['equation']
        description = eq['description']
        # Escape equation text to avoid regex issues
        pattern = re.escape(original_eq.strip())
        text = re.sub(pattern, description, text, flags=re.IGNORECASE)
    return text
