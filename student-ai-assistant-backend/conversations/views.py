
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import NotFound, ValidationError

from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer

from documents.models import Document
import json
from ai_engine.agent import run_studora_agent


class ConversationListCreateView(generics.ListCreateAPIView):
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Conversation.objects.filter(
            owner=self.request.user
        ).order_by("-updated_at")

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class ConversationDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Conversation.objects.filter(
            owner=self.request.user
        )



class MessageCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, conversation_id):
        # 1. Find the conversation belonging to the logged-in student.
        try:
            conversation = Conversation.objects.get(
                id=conversation_id,
                owner=request.user
            )
        except Conversation.DoesNotExist:
            raise NotFound("Conversation not found.")

        # 2. Validate the student's question.
        content = str(request.data.get("content", "")).strip()

        if not content:
            raise ValidationError({
                "content": "Message cannot be empty."
            })

        # 3. Validate selected document IDs.
        document_id = request.data.get("document_id")
        document_ids = request.data.get("document_ids")

        selected_documents = []

        # Support the old single-document request format too.
        if document_ids is None:
            document_ids = []

            if document_id not in (None, ""):
                document_ids = [document_id]

        if not isinstance(document_ids, list):
            raise ValidationError({
                "document_ids": "Document IDs must be provided as a list."
            })

        # 4. Validate IDs and remove duplicates.
        validated_ids = []

        for doc_id in document_ids:
            try:
                validated_ids.append(int(doc_id))
            except (TypeError, ValueError):
                raise ValidationError({
                    "document_ids": (
                        "Every document ID must be an integer."
                    )
                })

        validated_ids = list(dict.fromkeys(validated_ids))

        # MCQ generation and summarization require at least one document.
        tool = str(
            request.data.get("tool", "")
        ).strip().lower()

        if tool in {"mcq", "summarize"} and not validated_ids:
            raise ValidationError({
                "document_ids": (
                    "Please select at least one document."
                )
            })

        # Retrieve only documents belonging to this user
        # that are ready to use.
        if validated_ids:
            selected_documents = list(
                Document.objects.filter(
                    id__in=validated_ids,
                    owner=request.user,
                    status="ready"
                )
            )

            found_ids = {
                document.id for document in selected_documents
            }

            if len(found_ids) != len(validated_ids):
                raise ValidationError({
                    "document_ids": (
                        "One or more documents were not found, "
                        "are not ready, or do not belong to you."
                    )
                })

            # Preserve the user's selection order.
            documents_by_id = {
                document.id: document
                for document in selected_documents
            }

            selected_documents = [
                documents_by_id[doc_id]
                for doc_id in validated_ids
            ]

        # Keep the first document available for compatibility
        # with any existing code that uses the variable.
        document = (
            selected_documents[0]
            if selected_documents
            else None
        )

        # 5. Retrieve previous messages before saving the new question.
        previous_messages = list(
            Message.objects.filter(
                conversation=conversation
            ).order_by("created_at", "id").values(
                "role",
                "content"
            )
        )

        # Include only the most recent 12 messages.
        previous_messages = previous_messages[-12:]

        # 6. Save the student's question.
        user_message = Message.objects.create(
            conversation=conversation,
            role="user",
            content=content
        )

        # 7. Generate the AI response.
        try:
            tool = str(
                request.data.get("tool", "")
            ).strip().lower()

            sources = []

            # --------------------------------------------------
            # FEATURE 1: MCQ GENERATION
            # Uses one selected document.
            # --------------------------------------------------
            if tool == "mcq":
                from ai_engine.mcq_generator import generate_mcqs

                if not selected_documents:
                    raise ValidationError({
                        "document_ids": (
                            "Please select at least one document "
                            "before generating MCQs."
                        )
                    })

                # Collect text from every selected document.
                document_sections = []

                for selected_doc in selected_documents:
                    document_text = (
                        selected_doc.extracted_text or ""
                    ).strip()

                    if not document_text:
                        raise ValidationError({
                            "document_ids": (
                                f'The document "{selected_doc.title}" '
                                "has no extracted text."
                            )
                        })

                    document_sections.append(
                        f"""
DOCUMENT: {selected_doc.title}

{document_text}
"""
                    )

                combined_document_text = "\n\n".join(
                    document_sections
                )

                question_count = request.data.get(
                    "question_count", 10
                )

                difficulty = request.data.get(
                    "difficulty", "Medium"
                )

                result = generate_mcqs(
                    document_text=combined_document_text,
                    question_count=question_count,
                    difficulty=difficulty,
                    topic=content
                )

                ai_answer = json.dumps(
                    result,
                    ensure_ascii=False
                )

                sources = [
                    {
                        "document_id": str(selected_doc.id),
                        "document_title": selected_doc.title
                    }
                    for selected_doc in selected_documents
                ]

            # --------------------------------------------------
            # FEATURE 2: DOCUMENT SUMMARIZATION
            # Uses one selected document.
            # --------------------------------------------------
            elif tool == "summarize":
                from ai_engine.document_summarizer import (
                    generate_document_summary
                )

                if not selected_documents:
                    raise ValidationError({
                        "document_ids": (
                            "Please select at least one document "
                            "before generating a summary."
                        )
                    })

                # Collect text from every selected document.
                document_sections = []

                for selected_doc in selected_documents:
                    document_text = (
                        selected_doc.extracted_text or ""
                    ).strip()

                    if not document_text:
                        raise ValidationError({
                            "document_ids": (
                                f'The document "{selected_doc.title}" '
                                "has no extracted text. "
                                "Please select documents with readable text."
                            )
                        })

                    document_sections.append(
                        f"""
DOCUMENT: {selected_doc.title}

{document_text}
"""
                    )

                combined_document_text = "\n\n".join(
                    document_sections
                )

                # Generate one combined summary.
                ai_answer = generate_document_summary(
                    document_text=combined_document_text
                )

                sources = [
                    {
                        "document_id": str(selected_doc.id),
                        "document_title": selected_doc.title
                    }
                    for selected_doc in selected_documents
                ]

            # --------------------------------------------------
            # FEATURE 3: GENERAL QUESTIONS / MULTI-DOCUMENT RAG
            # Can search one document, multiple documents,
            # or general knowledge when no document is selected.
            # --------------------------------------------------
            
            else:
                # General questions are handled by the LangGraph agent.
                result = run_studora_agent(
                    question=content,
                    owner_id=request.user.id,
                    selected_documents=selected_documents,
                    chat_history=previous_messages,
                )

                ai_answer = result["answer"]
                sources = result.get("sources", [])

                # Store tool execution information with the sources.
                # This makes it possible to inspect agent behavior
                # while testing the backend.
                if result.get("executed_tools"):
                    sources.append({
                        "source_type": "agent_metadata",
                        "tools_used": result["executed_tools"],
                    })

                if result.get("tool_errors"):
                    sources.append({
                        "source_type": "agent_errors",
                        "errors": result["tool_errors"],
                    })



        except ValidationError:
            raise

        except Exception as e:
            import traceback

            print("\n========== STUDORA AI ERROR ==========")
            print("Error type:", type(e).__name__)
            print("Error message:", repr(e))
            traceback.print_exc()
            print("======================================\n")

            error_msg = str(e)
            if any(term in error_msg.lower() for term in ["invalid_api_key", "incorrect api key", "authenticationerror", "401", "quota"]):
                user_msg = (
                    "Your LLM API key has expired or is invalid. "
                    "To fix this, get a 100% free API key from https://console.groq.com/keys "
                    "or https://aistudio.google.com/app/apikey and update OPENAI_API_KEY in your backend .env file."
                )
            else:
                user_msg = str(e)

            return Response(
                {
                    "status": "error",
                    "detail": user_msg
                },
                status=502
            )

        # 8. Save the assistant's answer and its sources.
        assistant_message = Message.objects.create(
            conversation=conversation,
            role="assistant",
            content=ai_answer,
            sources=sources
        )

        # 9. Set the conversation title from the first question.
        if conversation.title == "New Chat":
            conversation.title = content[:60]

        conversation.save()

        # 10. Return both messages.
        return Response(
            {
                "status": "success",
                "message": MessageSerializer(user_message).data,
                "reply": MessageSerializer(assistant_message).data,
                "conversation_id": conversation.id
            },
            status=201
        )

