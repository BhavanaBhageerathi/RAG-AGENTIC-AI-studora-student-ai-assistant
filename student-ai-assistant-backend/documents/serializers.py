from rest_framework import serializers
from .models import Document


class DocumentSerializer(serializers.ModelSerializer):
    size = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = ["id", "title", "file", "file_type", "status", "uploaded_at", "size"]
        read_only_fields = ["id", "file_type", "status", "uploaded_at", "size"]

    def get_size(self, obj):
        if not obj.file:
            return 0
        try:
            return obj.file.size
        except (OSError, ValueError):
            return 0
