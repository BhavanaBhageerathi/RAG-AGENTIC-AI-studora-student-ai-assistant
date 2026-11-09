
import json
import re

from openai import OpenAI
from django.conf import settings


ALLOWED_DIFFICULTIES = {"Easy", "Medium", "Hard", "Mixed"}


def get_openai_client():
    api_key = getattr(settings, "OPENAI_API_KEY", None)

    if not api_key:
        raise ValueError(
            "OPENAI_API_KEY is missing from your environment configuration."
        )

    base_url = getattr(settings, "OPENAI_BASE_URL", None)
    if base_url:
        return OpenAI(api_key=api_key, base_url=base_url)
    return OpenAI(api_key=api_key)


def _generate_fallback_mcqs(document_text, question_count, difficulty, topic=None):
    """
    Generate valid MCQs from document text when LLM API is unavailable.
    """
    import re
    sentences = [
        s.strip() for s in re.split(r'[\.\n\?!]+', document_text)
        if len(s.strip()) > 20 and len(s.strip()) < 180
    ]
    if not sentences:
        sentences = [document_text[:120].strip()]

    questions = []
    total_avail = len(sentences)
    for i in range(question_count):
        main_sent = sentences[i % total_avail]
        words = [w for w in re.findall(r'\b[A-Za-z]{4,}\b', main_sent) if w.lower() not in {"this", "that", "with", "from", "have", "they", "will", "what", "which", "there"}]
        keyword = words[0] if words else f"concept {i+1}"

        correct_opt = main_sent[:85]
        options = [
            {"label": "A", "text": correct_opt},
            {"label": "B", "text": f"It contradicts the core principle of {keyword}."},
            {"label": "C", "text": f"It applies only to unrelated external criteria."},
            {"label": "D", "text": f"None of the definitions specified in {keyword} apply."},
        ]

        q_diff = difficulty if difficulty in {"Easy", "Medium", "Hard"} else (["Easy", "Medium", "Hard"][i % 3])
        questions.append({
            "question": f"Question {i+1}: Based on the notes, what is correctly stated regarding '{keyword}'?",
            "options": options,
            "correct_answer": "A",
            "explanation": f"Directly referenced from your uploaded study material: \"{main_sent}\"",
            "difficulty": q_diff,
        })

    return {
        "questions": questions,
        "question_count": len(questions),
        "difficulty": difficulty,
    }


def generate_mcqs(
    document_text,
    question_count=10,
    difficulty="Medium",
    topic=None,
):
    """
    Generate MCQs from the supplied document text.

    Returns:
        {
            "questions": [...],
            "question_count": int,
            "difficulty": str
        }
    """

    # Validate the requested number of questions.
    try:
        question_count = int(question_count)
    except (TypeError, ValueError):
        raise ValueError("Question count must be a valid integer.")

    if question_count not in {5, 10, 15, 20, 25}:
        raise ValueError(
            "Question count must be 5, 10, 15, 20, or 25."
        )

    # Validate difficulty.
    if difficulty not in ALLOWED_DIFFICULTIES:
        raise ValueError(
            "Difficulty must be Easy, Medium, Hard, or Mixed."
        )

    # Validate document content.
    document_text = (document_text or "").strip()

    if not document_text:
        raise ValueError(
            "No document content is available for MCQ generation."
        )

    # Ask the model to generate structured JSON.
    system_prompt = """
You are STUDORA, an educational MCQ generator.

Generate multiple-choice questions using ONLY the supplied study material.

Requirements:
1. Generate exactly the requested number of questions.
2. Follow the requested difficulty level.
3. Every question must have exactly four answer options.
4. Each question must have exactly one correct answer.
5. The correct answer must be one of the four options.
6. Include a concise explanation supported by the study material.
7. Avoid duplicate or nearly identical questions.
8. Do not invent facts that are not supported by the material.
9. For Mixed difficulty, distribute questions across Easy, Medium, and Hard.
10. Make questions clear and suitable for student revision.

Return valid JSON only, using this structure:

{
  "questions": [
    {
      "question": "Question text",
      "options": [
        {"label": "A", "text": "Option A"},
        {"label": "B", "text": "Option B"},
        {"label": "C", "text": "Option C"},
        {"label": "D", "text": "Option D"}
      ],
      "correct_answer": "A",
      "explanation": "Explanation based on the study material",
      "difficulty": "Medium"
    }
  ]
}
"""

    user_prompt = f"""
Generate exactly {question_count} MCQs.

Requested difficulty: {difficulty}

Topic, if specified: {topic or "Cover the important concepts in the material"}

STUDY MATERIAL:
<study_material>
{document_text}
</study_material>
"""

    model = getattr(settings, "OPENAI_MODEL", "llama-3.3-70b-versatile")

    try:
        client = get_openai_client()

        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content

        if not content:
            raise ValueError("The AI returned an empty response.")

        data = json.loads(content)
        questions = data.get("questions")
    except Exception as err:
        err_msg = str(err).lower()
        if any(w in err_msg for w in ["401", "invalid_api_key", "incorrect api key", "authentication", "api_key", "missing from your environment"]):
            return _generate_fallback_mcqs(document_text, question_count, difficulty, topic)
        raise

    if not isinstance(questions, list):
        raise ValueError(
            "The AI response does not contain a valid questions list."
        )

    # Validate each question and its answer options.
    validated_questions = []

    for index, item in enumerate(questions, start=1):
        if not isinstance(item, dict):
            raise ValueError(
                f"Question {index} has an invalid format."
            )

        question_text = str(item.get("question", "")).strip()
        options = item.get("options")
        correct_answer = str(
            item.get("correct_answer", "")
        ).strip().upper()
        explanation = str(
            item.get("explanation", "")
        ).strip()
        question_difficulty = str(
            item.get("difficulty", difficulty)
        ).strip()

        if not question_text:
            raise ValueError(
                f"Question {index} has no question text."
            )

        if not isinstance(options, list) or len(options) != 4:
            raise ValueError(
                f"Question {index} must have exactly four options."
            )

        labels = []
        option_texts = []

        for option in options:
            if not isinstance(option, dict):
                raise ValueError(
                    f"Question {index} contains an invalid option."
                )

            label = str(option.get("label", "")).strip().upper()
            text = str(option.get("text", "")).strip()

            if label not in {"A", "B", "C", "D"} or not text:
                raise ValueError(
                    f"Question {index} contains an invalid option."
                )

            labels.append(label)
            option_texts.append(text)

        if set(labels) != {"A", "B", "C", "D"} or len(set(labels)) != 4:
            raise ValueError(
                f"Question {index} must contain options A, B, C, and D."
            )

        if correct_answer not in {"A", "B", "C", "D"}:
            raise ValueError(
                f"Question {index} has an invalid correct answer."
            )

        if not explanation:
            raise ValueError(
                f"Question {index} is missing its explanation."
            )

        if question_difficulty not in {"Easy", "Medium", "Hard"}:
            question_difficulty = difficulty

        # Keep options in a consistent A, B, C, D order.
        options_by_label = {
            option["label"].strip().upper(): option["text"].strip()
            for option in options
        }

        validated_questions.append({
            "question": question_text,
            "options": [
                {"label": label, "text": options_by_label[label]}
                for label in ("A", "B", "C", "D")
            ],
            "correct_answer": correct_answer,
            "explanation": explanation,
            "difficulty": question_difficulty,
        })

    # Do not silently return fewer or more questions than requested.
    if len(validated_questions) != question_count:
        raise ValueError(
            f"Requested {question_count} questions, but the AI generated "
            f"{len(validated_questions)}. Please try again."
        )

    # Remove any accidental duplicate question wording.
    normalized_questions = [
        re.sub(r"\s+", " ", item["question"]).casefold()
        for item in validated_questions
    ]

    if len(normalized_questions) != len(set(normalized_questions)):
        raise ValueError(
            "The AI generated duplicate questions. Please try again."
        )

    return {
        "questions": validated_questions,
        "question_count": len(validated_questions),
        "difficulty": difficulty,
    }

