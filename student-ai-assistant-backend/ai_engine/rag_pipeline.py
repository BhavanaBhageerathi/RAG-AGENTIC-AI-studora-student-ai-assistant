
from openai import OpenAI
from django.conf import settings

from ai_engine.vector_store import search_document_chunks


def get_openai_client():
    """
    Create the OpenAI client using the API key from Django settings.
    """
    api_key = getattr(settings, "OPENAI_API_KEY", None)

    if not api_key:
        raise ValueError(
            "OPENAI_API_KEY is missing from your environment configuration."
        )

    base_url = getattr(settings, "OPENAI_BASE_URL", None)
    if base_url:
        return OpenAI(api_key=api_key, base_url=base_url)
    return OpenAI(api_key=api_key)


def answer_question(
    question,
    owner_id,
    document_id=None,
    document_ids=None,
    top_k=4,
    chat_history=None,
):
    """
    Answer a student's question using relevant document chunks
    and previous conversation messages.

    Supports:
    - General questions without selected documents.
    - Questions about one selected document.
    - Questions across multiple selected documents.
    """

    chat_history = chat_history or []

    # 1. Retrieve relevant chunks from the selected documents.
    retrieved_chunks = search_document_chunks(
        query=question,
        owner_id=owner_id,
        document_id=document_id,
        document_ids=document_ids,
        top_k=top_k,
    )

    # 2. Prepare document context with source information.
    context_parts = []

    for chunk in retrieved_chunks:
        metadata = chunk.get("metadata", {})
        doc_id = metadata.get("document_id", "Unknown")
        chunk_index = metadata.get("chunk_index", "Unknown")

        context_parts.append(
            f"""
Document ID: {doc_id}
Chunk index: {chunk_index}
Content:
{chunk["text"]}
"""
        )

    context = "\n\n".join(context_parts)

    # 3. Build the system instructions.
    if context:
        system_prompt = f"""
You are STUDORA, a helpful AI assistant for students.

Answer the student's question using the supplied document context
when it is relevant.

You may use previous conversation messages to understand
follow-up questions.

IMPORTANT:
- Use the provided document context for document-based questions.
- Do not invent facts or claim that a document says something
  that is not supported by its content.
- If the selected documents do not contain enough information,
  clearly explain what information is missing.
- When information from different documents is relevant, combine
  it carefully and distinguish the information where necessary.

DOCUMENT CONTEXT:
{context}
"""
    else:
        system_prompt = """
You are STUDORA, a helpful AI assistant for students.

Use previous conversation messages to understand follow-up
questions and maintain context.

If no relevant document context is available, answer using your
general knowledge where appropriate. Be honest when you are unsure.
"""

    # 4. Construct the conversation sent to OpenAI.
    messages = [
        {
            "role": "system",
            "content": system_prompt,
        }
    ]

    for item in chat_history:
        role = item.get("role")
        content = item.get("content", "").strip()

        if role in ("user", "assistant") and content:
            messages.append(
                {
                    "role": role,
                    "content": content,
                }
            )

    # Add the current question last.
    messages.append(
        {
            "role": "user",
            "content": question,
        }
    )

    # 5. Generate the AI response.
    model = getattr(settings, "OPENAI_MODEL", "openai/gpt-oss-20b")
    try:
        client = get_openai_client()

        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.3,
        )

        answer = response.choices[0].message.content or ""
    except Exception as err:
        err_msg = str(err).lower()
        if any(w in err_msg for w in ["401", "invalid_api_key", "incorrect api key", "authentication", "api_key", "missing from your environment"]):
            if context:
                answer = (
                    f"**Here are the relevant excerpts found in your notes:**\n\n"
                    f"{context}\n\n"
                    f"---\n"
                    f"💡 *Note: Your API key has expired. Add a free Groq or Gemini API key in backend `.env` for AI answers.*"
                )
            else:
                answer = (
                    f"Your LLM API key has expired. Please add a free Groq (console.groq.com/keys) or "
                    f"Google Gemini (aistudio.google.com) API key in `student-ai-assistant-backend/.env`."
                )
        else:
            raise

    # 6. Return the answer and source information.
    sources = [
        {
            "document_id": str(chunk["metadata"]["document_id"]),
            "chunk_index": chunk["metadata"]["chunk_index"],
        }
        for chunk in retrieved_chunks
    ]

    return {
        "answer": answer,
        "sources": sources,
    }

