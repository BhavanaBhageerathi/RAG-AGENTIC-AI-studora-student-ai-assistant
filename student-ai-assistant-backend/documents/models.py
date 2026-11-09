from django.conf import settings
from django.db import models

class Document(models.Model):
    STATUS_CHOICES = [("processing", "Processing"), ("ready", "Ready"), ("failed", "Failed")]
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="documents")
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to="documents/%Y/%m/")
    file_type = models.CharField(max_length=20, blank=True)
    extracted_text = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="processing")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title
