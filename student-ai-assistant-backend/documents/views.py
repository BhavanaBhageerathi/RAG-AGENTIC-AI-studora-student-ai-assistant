import logging
from pathlib import Path

import pytesseract
from PyPDF2 import PdfReader
from rest_framework import generics, permissions, parsers
from rest_framework.exceptions import ValidationError

from ai_engine.chunking import split_text_into_chunks
from ai_engine.vector_store import add_document_chunks

from .models import Document
from .serializers import DocumentSerializer

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".pdf", ".txt"}

# Configure this only after installing Tesseract itself.

# This must point to tesseract.exe, NOT its installer.

# Example:

# pytesseract.pytesseract.tesseract_cmd = (

# r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# )

def extract_document_text(uploaded_file):
    """
    Extract text from PDF and TXT files.


    For PDFs:
    1. Try normal PDF text extraction.
    2. If no text is available, attempt OCR.
    """

    suffix = Path(uploaded_file.name).suffix.lower()

    # Extract text from TXT files.
    if suffix == ".txt":
        uploaded_file.seek(0)

        text = uploaded_file.read().decode(
            "utf-8",
            errors="replace",
        )

        if not text.strip():
            raise ValueError("The text file is empty.")

        return text

    # Extract text from PDF files.
    if suffix == ".pdf":
        uploaded_file.seek(0)

        try:
            reader = PdfReader(uploaded_file)

            if reader.is_encrypted:
                result = reader.decrypt("")

                if not result:
                    raise ValueError(
                        "The PDF is password-protected."
                    )

            extracted_pages = []

            for page_number, page in enumerate(
                reader.pages,
                start=1,
            ):
                page_text = page.extract_text() or ""

                extracted_pages.append(page_text)

                logger.info(
                    "PDF page %s: extracted %s characters.",
                    page_number,
                    len(page_text),
                )

            text = "\n".join(extracted_pages).strip()

            if text:
                logger.info(
                    "Successfully extracted text from '%s'.",
                    uploaded_file.name,
                )
                return text

        except Exception as error:
            logger.exception(
                "Unable to read PDF '%s'.",
                uploaded_file.name,
            )

            raise ValueError(
                "The PDF could not be read. It may be damaged "
                "or password-protected."
            ) from error

        # Attempt OCR if normal extraction returned no text.
        logger.info(
            "No selectable text found in '%s'. Attempting OCR.",
            uploaded_file.name,
        )

        try:
            from pdf2image import convert_from_bytes

            uploaded_file.seek(0)
            pdf_bytes = uploaded_file.read()

            images = convert_from_bytes(
                pdf_bytes,
                dpi=200,
            )

            ocr_pages = []

            for page_number, image in enumerate(
                images,
                start=1,
            ):
                page_text = pytesseract.image_to_string(image)

                ocr_pages.append(page_text)

                logger.info(
                    "OCR page %s: extracted %s characters.",
                    page_number,
                    len(page_text),
                )

            ocr_text = "\n".join(ocr_pages).strip()

            if not ocr_text:
                raise ValueError(
                    "No readable text was found, even after OCR."
                )

            logger.info(
                "OCR successfully processed '%s'.",
                uploaded_file.name,
            )

            return ocr_text

        except ImportError as error:
            logger.exception(
                "OCR dependencies are missing."
            )

            raise ValueError(
                "This appears to be a scanned PDF. Install "
                "pdf2image and Pillow, and configure Tesseract "
                "OCR and Poppler."
            ) from error

        except Exception as error:
            logger.exception(
                "OCR processing failed for '%s'.",
                uploaded_file.name,
            )

            raise ValueError(
                "Text extraction and OCR failed. Check that "
                "Tesseract OCR and Poppler are installed correctly."
            ) from error

    raise ValidationError({
        "file": "Only PDF and TXT files are supported."
    })


class DocumentListCreateView(generics.ListCreateAPIView):
    """
    List the logged-in student's documents and upload new ones.
    """


    serializer_class = DocumentSerializer

    parser_classes = [
        parsers.MultiPartParser,
        parsers.FormParser,
        parsers.JSONParser,
    ]

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        return Document.objects.filter(
            owner=self.request.user
        ).order_by("-uploaded_at")

    def perform_create(self, serializer):
        uploaded_file = self.request.FILES.get("file")

        if not uploaded_file:
            raise ValidationError({
                "file": "Choose a PDF or TXT file to upload."
            })

        suffix = Path(uploaded_file.name).suffix.lower()

        if suffix not in ALLOWED_EXTENSIONS:
            raise ValidationError({
                "file": "Only PDF and TXT files are supported."
            })

        # Save the uploaded document first.
        document = serializer.save(
            owner=self.request.user,
            title=(
                serializer.validated_data.get("title")
                or Path(uploaded_file.name).stem
            ),
        )

        try:
            # 1. Extract document text.
            with document.file.open("rb") as stored_file:
                text = extract_document_text(stored_file)

            if not text.strip():
                raise ValueError(
                    "No readable text was extracted."
                )

            # 2. Split the text into chunks.
            chunks = split_text_into_chunks(
                text,
                chunk_size=1000,
                chunk_overlap=200,
            )

            if not chunks:
                raise ValueError(
                    "No text chunks were created."
                )

            logger.info(
                "Created %s chunks for '%s'.",
                len(chunks),
                document.title,
            )

            # 3. Generate embeddings and store chunks.
            stored_count = add_document_chunks(
                document_id=document.id,
                owner_id=self.request.user.id,
                chunks=chunks,
            )

            if stored_count != len(chunks):
                raise ValueError(
                    "Not all document chunks were indexed."
                )

            # 4. Update the document only after indexing succeeds.
            document.extracted_text = text
            document.file_type = suffix.lstrip(".")
            document.status = "ready"

            document.save(
                update_fields=[
                    "extracted_text",
                    "file_type",
                    "status",
                ]
            )

            logger.info(
                "Document '%s' processed successfully. "
                "Extracted %s characters and indexed %s chunks.",
                document.title,
                len(text),
                stored_count,
            )

        except Exception as error:
            document.status = "failed"

            document.save(
                update_fields=["status"]
            )

            logger.exception(
                "Failed to process document '%s': %s",
                document.title,
                str(error),
            )

            raise ValidationError({
                "file": (
                    "The file was uploaded, but document "
                    "processing or indexing failed. Check the "
                    "Django terminal for details."
                )
            }) from error


class DocumentDetailView(generics.RetrieveDestroyAPIView):
    """
    Retrieve or delete a document belonging to the logged-in student.
    """


    serializer_class = DocumentSerializer

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get_queryset(self):
        return Document.objects.filter(
            owner=self.request.user
        )

