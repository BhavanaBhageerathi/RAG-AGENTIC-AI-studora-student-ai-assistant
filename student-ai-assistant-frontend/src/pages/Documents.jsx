
import { useRef, useState } from "react";
import api from "../services/api";

function Documents({ documents, onUpload, setDocuments }) {
    const fileRef = useRef(null);

    const [uploading, setUploading] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [error, setError] = useState("");

    // Format file size.
    function formatSize(bytes) {
        if (!bytes) return "0 B";

        if (bytes < 1024) {
            return `${bytes} B`;
        }

        if (bytes < 1024 * 1024) {
            return `${Math.round(bytes / 1024)} KB`;
        }

        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    // Upload selected files through the shared upload function.
    async function handleUpload(event) {
        const input = event.target;
        const files = Array.from(input.files || []);

        if (!files.length) return;

        setUploading(true);
        setError("");

        try {
            await onUpload(files);
        } catch (uploadError) {
            console.error("Document upload failed:", uploadError);

            const responseData = uploadError.response?.data;

            if (responseData) {
                setError(
                    typeof responseData === "string"
                        ? responseData
                        : JSON.stringify(responseData)
                );
            } else {
                setError(
                    uploadError.message ||
                    "Upload failed. Check the Django server and try again."
                );
            }
        } finally {
            setUploading(false);
            input.value = "";
        }
    }

    // Open the uploaded document in a new tab.
    function openDocument(document) {
        if (!document.file || typeof document.file !== "string") {
            setError("This document does not have an accessible file URL.");
            return;
        }

        window.open(
            document.file,
            "_blank",
            "noopener,noreferrer"
        );
    }

    // Delete a document from the backend.
    async function handleDelete(document) {
        const confirmed = window.confirm(
            `Are you sure you want to delete "${document.title || document.name}"?`
        );

        if (!confirmed) return;

        setDeletingId(document.id);
        setError("");

        try {
            await api.delete(`documents/${document.id}/`);

            if (setDocuments) {
                setDocuments((previousDocuments) =>
                    previousDocuments.filter(
                        (item) =>
                            String(item.id) !== String(document.id)
                    )
                );
            }
        } catch (deleteError) {
            console.error("Document deletion failed:", deleteError);

            const responseData = deleteError.response?.data;

            setError(
                responseData
                    ? typeof responseData === "string"
                        ? responseData
                        : JSON.stringify(responseData)
                    : "Could not delete the document. Please try again."
            );
        } finally {
            setDeletingId(null);
        }
    }

    return (
        <section className="simple-page documents-page">

            {/* Page heading */}
            <div className="page-heading-row">
                <div>
                    <p className="eyebrow">YOUR LIBRARY</p>
                    <h1>My documents</h1>
                </div>

                <button
                    type="button"
                    className="primary-button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                >
                    <i className="bi bi-paperclip"></i>{" "}
                    {uploading ? "Uploading..." : "Choose files"}
                </button>
            </div>

            {/* Hidden file input */}
            <input
                ref={fileRef}
                type="file"
                multiple
                hidden
                accept=".pdf,.txt"
                onChange={handleUpload}
            />

            {/* Error message */}
            {error && (
                <div className="alert alert-danger" role="alert">
                    {error}

                    <button
                        type="button"
                        className="btn-close ms-2"
                        aria-label="Dismiss error"
                        onClick={() => setError("")}
                    ></button>
                </div>
            )}

            {/* Documents heading */}
            <div className="section-heading">
                <h2>Uploaded files</h2>
                <span>
                    {documents.length}{" "}
                    {documents.length === 1 ? "file" : "files"}
                </span>
            </div>

            {/* Empty state */}
            {documents.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">
                        <i className="bi bi-folder2-open"></i>
                    </div>

                    <h3>No documents yet</h3>

                    <p>
                        Your uploaded notes will appear here.
                    </p>

                    <button
                        type="button"
                        className="primary-button"
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                    >
                        <i className="bi bi-plus-lg"></i>{" "}
                        Upload your first document
                    </button>
                </div>
            ) : (

                /* Uploaded document list */
                <div className="document-list">
                    {documents.map((document) => (
                        <div
                            className="document-item"
                            key={document.id}
                        >
                            {/* Document icon and details */}
                            <button
                                type="button"
                                className="document-open-button"
                                onClick={() => openDocument(document)}
                                title="Open document"
                                aria-label={`Open ${
                                    document.name || document.title
                                }`}
                            >
                                <span className="file-icon">
                                    <i className="bi bi-file-earmark-text"></i>
                                </span>

                                <div className="document-info">
                                    <strong>
                                        {document.name || document.title}
                                    </strong>

                                    <span>
                                        {formatSize(document.size || 0)}
                                    </span>
                                </div>
                            </button>

                            {/* Status and action buttons */}
                            <div className="document-actions">

                                {/* Document status */}
                                <span
                                    className={`file-status ${
                                        document.status === "ready"
                                            ? "status-ready"
                                            : document.status === "failed"
                                            ? "status-failed"
                                            : "status-processing"
                                    }`}
                                >
                                    {document.status === "ready"
                                        ? "Ready"
                                        : document.status === "failed"
                                        ? "Failed"
                                        : "Processing"}
                                </span>

                                {/* Open document */}
                                <button
                                    type="button"
                                    className="open-document-icon"
                                    onClick={() => openDocument(document)}
                                    title="Open document"
                                    aria-label={`Open ${
                                        document.name || document.title
                                    }`}
                                    disabled={!document.file}
                                >
                                    <i className="bi bi-box-arrow-up-right"></i>
                                </button>

                                {/* Delete document */}
                                <button
                                    type="button"
                                    className="delete-document-icon"
                                    onClick={() => handleDelete(document)}
                                    title="Delete document"
                                    aria-label={`Delete ${
                                        document.name || document.title
                                    }`}
                                    disabled={deletingId === document.id}
                                >
                                    <i
                                        className={`bi ${
                                            deletingId === document.id
                                                ? "bi-hourglass-split"
                                                : "bi-trash3"
                                        }`}
                                    ></i>
                                </button>

                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

export default Documents;

