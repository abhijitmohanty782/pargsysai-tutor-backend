# Use slim Python image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Copy ONLY requirements first to use caching
COPY requirements.txt .

# Install dependencies first
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Now copy the rest of the source code
COPY . .

# Expose FastAPI port
EXPOSE 8000

# Run the app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
