
from pathlib import Path

import chromadb
from django.conf import settings

from ai_engine.embeddings import (
    generate_embeddings,
    generate_query_embedding,
)


# Persistent ChromaDB storage directory
CHROMA_DIRECTORY = Path(settings.BASE_DIR) / "chroma_db"

CHROMA_DIRECTORY.mkdir(parents=True, exist_ok=True)

client = chromadb.PersistentClient(
    path=str(CHROMA_DIRECTORY)
)

collection = client.get_or_create_collection(
    name="studora_documents",
    metadata={"hnsw:space": "cosine"}
)


def add_document_chunks(document_id, owner_id, chunks):
    """
    Generate embeddings and store document chunks
    with their metadata in ChromaDB.
    """

    if not chunks:
        return 0

    embeddings = generate_embeddings(chunks)

    ids = [
        f"doc_{document_id}_chunk_{index}"
        for index in range(len(chunks))
    ]

    metadatas = [
        {
            "document_id": str(document_id),
            "owner_id": str(owner_id),
            "chunk_index": index,
        }
        for index in range(len(chunks))
    ]

    collection.upsert(
        ids=ids,
        documents=chunks,
        embeddings=embeddings,
        metadatas=metadatas,
    )

    return len(chunks)


def search_document_chunks(
    query,
    owner_id,
    document_id=None,
    document_ids=None,
    top_k=4,
):
    """
    Retrieve relevant document chunks belonging to
    the authenticated student's documents.

    Supports:
    1. Searching all the user's documents.
    2. Searching one selected document.
    3. Searching multiple selected documents.
    """

    if not query or not query.strip():
        return []

    query_embedding = generate_query_embedding(query)

    # Always restrict retrieval to the authenticated owner.
    filters = {
        "owner_id": str(owner_id)
    }

    # Normalize the selected document IDs.
    selected_ids = []

    if document_ids is not None:
        selected_ids = [
            str(doc_id)
            for doc_id in document_ids
        ]

    # Maintain compatibility with existing single-document calls.
    elif document_id is not None:
        selected_ids = [str(document_id)]

    # If documents were selected, restrict retrieval to them.
    if selected_ids:
        filters = {
            "$and": [
                {
                    "owner_id": str(owner_id)
                },
                {
                    "document_id": {
                        "$in": selected_ids
                    }
                },
            ]
        }

    # Retrieve the most relevant chunks.
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        where=filters,
        include=[
            "documents",
            "metadatas",
            "distances",
        ],
    )

    matches = []

    documents = results.get("documents") or [[]]
    metadatas = results.get("metadatas") or [[]]
    distances = results.get("distances") or [[]]

    for text, metadata, distance in zip(
        documents[0],
        metadatas[0],
        distances[0],
    ):
        matches.append({
            "text": text,
            "metadata": metadata,
            "distance": distance,
        })

    return matches

