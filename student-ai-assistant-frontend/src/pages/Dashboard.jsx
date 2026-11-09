
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const tools = [
    {
        title: "Summarize",
        text: "Turn notes into clear summaries",
        icon: "bi-journal-text",
        color: "lilac",
        prompt: "Summarize my study notes",
    },
    {
        title: "Ask questions",
        text: "Get answers from your notes",
        icon: "bi-chat-square-text",
        color: "mint",
        prompt: "I want to ask questions about my notes",
    },
    {
        title: "Generate MCQs",
        text: "Practice with a quick quiz",
        icon: "bi-ui-checks-grid",
        color: "peach",
        prompt: "Generate MCQs from my study notes",
    },
    {
        title: "General Asking",
        text: "Ask any academic or study question",
        icon: "bi-chat-dots",
        color: "sky",
        prompt: "Can you help me understand a study topic?",
    },
];

function Dashboard({ onStart, documents = [], onUpload }) {
    const navigate = useNavigate();
    const fileRef = useRef(null);

    const [prompt, setPrompt] = useState("");
    const [showDocumentPicker, setShowDocumentPicker] = useState(false);
    const [selectedDocumentId, setSelectedDocumentId] = useState("");
    const [selectedDocuments, setSelectedDocuments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState("");

    const validDocuments = documents.filter(
        (document) => document.status !== "failed"
    );

    function openTool(tool) {
        onStart(tool.title);

        navigate("/workspace", {
            state: {
                tool: tool.title,
                prompt: tool.prompt,
            },
        });
    }

    function handleSelectDocument(event) {
        const documentId = event.target.value;

        if (!documentId) return;

        const document = validDocuments.find(
            (item) => String(item.id) === String(documentId)
        );

        if (!document) return;

        setSelectedDocuments((previousDocuments) => {
            const alreadySelected = previousDocuments.some(
                (item) => String(item.id) === String(document.id)
            );

            if (alreadySelected) {
                return previousDocuments;
            }

            return [...previousDocuments, document];
        });

        setSelectedDocumentId("");
    }

    function removeDocument(documentId) {
        setSelectedDocuments((previousDocuments) =>
            previousDocuments.filter(
                (document) =>
                    String(document.id) !== String(documentId)
            )
        );
    }

    async function handleUpload(event) {
        const input = event.target;
        const files = Array.from(input.files || []);

        if (!files.length) return;

        setUploading(true);
        setUploadError("");

        try {
            const uploadedDocuments = await onUpload(files);

            if (Array.isArray(uploadedDocuments)) {
                setSelectedDocuments((previousDocuments) => {
                    const existingIds = new Set(
                        previousDocuments.map((document) =>
                            String(document.id)
                        )
                    );

                    const newDocuments = uploadedDocuments.filter(
                        (document) =>
                            document.status !== "failed" &&
                            !existingIds.has(String(document.id))
                    );

                    return [...previousDocuments, ...newDocuments];
                });
            }
        } catch (error) {
            console.error(
                "Document upload failed:",
                error.response?.data || error.message
            );

            const responseData = error.response?.data;

            setUploadError(
                typeof responseData === "string"
                    ? responseData
                    : responseData
                      ? JSON.stringify(responseData)
                      : error.message || "Unable to upload documents."
            );
        } finally {
            setUploading(false);
            input.value = "";
        }
    }

    function handleSubmit(event) {
        event.preventDefault();

        const question = prompt.trim();

        if (!question) return;

        onStart("Chat");

        navigate("/workspace", {
            state: {
                prompt: question,
                selectedDocumentIds: selectedDocuments.map(
                    (document) => document.id
                ),
            },
        });
    }

    return (
        <section className="home-page">
            <div className="welcome-block">
                <div className="welcome-icon">
                    <i className="bi bi-book-half"></i>
                    <i className="bi bi-stars welcome-sparkle"></i>
                </div>

                <p className="eyebrow">YOUR AI STUDY PARTNER</p>

                <h1>
                    What are we learning <span>today?</span>
                </h1>

                <p className="welcome-subtitle">
                    Pick a tool or ask me anything.
                </p>
            </div>

            <div className="tool-grid">
                {tools.map((tool) => (
                    <button
                        type="button"
                        className={"tool-card " + tool.color}
                        key={tool.title}
                        onClick={() => openTool(tool)}
                    >
                        <span className="tool-icon">
                            <i className={"bi " + tool.icon}></i>
                        </span>

                        <span className="tool-title">
                            {tool.title}
                        </span>

                        <span className="tool-description">
                            {tool.text}
                        </span>

                        <i className="bi bi-arrow-up-right tool-arrow"></i>
                    </button>
                ))}
            </div>

            {/* General question input */}
            <form className="home-prompt" onSubmit={handleSubmit}>
                <textarea
                    name="prompt"
                    rows="2"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Ask anything about your studies..."
                    onKeyDown={(event) => {
                        if (
                            event.key === "Enter" &&
                            !event.shiftKey
                        ) {
                            event.preventDefault();
                            event.currentTarget.form.requestSubmit();
                        }
                    }}
                />

                <div className="prompt-bottom">
                    <button
                        type="button"
                        className="attach-button"
                        onClick={() => {
                            setShowDocumentPicker((previous) => !previous);
                            setUploadError("");
                        }}
                    >
                        <i className="bi bi-paperclip"></i>
                        {showDocumentPicker ? "Hide notes" : "Add notes"}
                    </button>

                    <button
                        type="submit"
                        className="send-button"
                        aria-label="Send"
                    >
                        <i className="bi bi-arrow-up"></i>
                    </button>
                </div>
            </form>

            {/* Document picker appears when Add notes is clicked */}
            {showDocumentPicker && (
                <div className="study-tool-options home-document-picker">
                    <div className="study-option-row">
                        <label
                            className="study-option-label"
                            htmlFor="home-uploaded-document"
                        >
                            Choose from uploaded documents
                        </label>

                        <select
                            id="home-uploaded-document"
                            className="study-option-control"
                            value={selectedDocumentId}
                            onChange={handleSelectDocument}
                        >
                            <option value="">
                                Select a document
                            </option>

                            {validDocuments.map((document) => (
                                <option
                                    key={document.id}
                                    value={document.id}
                                >
                                    {document.title || document.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="study-option-row">
                        <span className="study-option-label">
                            Or upload a new document
                        </span>

                        <button
                            type="button"
                            className="outline-button study-upload-button"
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading}
                        >
                            <i className="bi bi-paperclip"></i>{" "}
                            {uploading ? "Uploading..." : "Choose files"}
                        </button>
                    </div>

                    <input
                        ref={fileRef}
                        type="file"
                        multiple
                        hidden
                        accept=".pdf,.txt"
                        onChange={handleUpload}
                    />

                    {uploadError && (
                        <div className="alert alert-danger" role="alert">
                            {uploadError}
                        </div>
                    )}

                    {selectedDocuments.length > 0 && (
                        <div className="selected-documents-section">
                            <span className="study-option-label">
                                Selected documents
                            </span>

                            <div className="selected-documents-list">
                                {selectedDocuments.map((document) => (
                                    <div
                                        className="selected-document"
                                        key={document.id}
                                    >
                                        <i className="bi bi-file-earmark-text"></i>

                                        <span className="selected-document-name">
                                            {document.title || document.name}
                                        </span>

                                        <button
                                            type="button"
                                            className="remove-document"
                                            onClick={() =>
                                                removeDocument(document.id)
                                            }
                                            title="Remove document"
                                            aria-label={`Remove ${
                                                document.title || document.name
                                            }`}
                                        >
                                            <i className="bi bi-x-lg"></i>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {validDocuments.length === 0 && (
                        <p className="study-option-hint">
                            No uploaded documents yet. Choose files to upload
                            your notes.
                        </p>
                    )}
                </div>
            )}

            <div className="home-footnote">
                <i className="bi bi-shield-check"></i>
                Your learning, at your pace
            </div>
        </section>
    );
}

export default Dashboard;

