from django.urls import path
from .views import ConversationListCreateView, ConversationDetailView, MessageCreateView
urlpatterns = [
    path("history/", ConversationListCreateView.as_view(), name="chat-history"),
    path("conversations/", ConversationListCreateView.as_view(), name="conversation-list-create"),
    path("conversations/<int:pk>/", ConversationDetailView.as_view(), name="conversation-detail"),
    path("conversations/<int:conversation_id>/messages/", MessageCreateView.as_view(), name="message-create"),
]
