from sentence_transformers import SentenceTransformer

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

_embedding_model = None

def get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = SentenceTransformer(MODEL_NAME)
    return _embedding_model

def generate_embeddings(texts):
    """
    Generate embeddings for multiple document chunks.
    Returns 384-dimensional vectors.
    """
    if not texts:
        return []

    model = get_embedding_model()
    embeddings = model.encode(
        texts,
        convert_to_numpy=True,
        normalize_embeddings=True
    )

    return embeddings.tolist()


def generate_query_embedding(query):
    """
    Generate an embedding for a student's question.
    Returns a 384-dimensional vector.
    """
    if not query or not query.strip():
        raise ValueError("The query cannot be empty.")

    model = get_embedding_model()
    embedding = model.encode(
        query,
        convert_to_numpy=True,
        normalize_embeddings=True
    )

    return embedding.tolist()

