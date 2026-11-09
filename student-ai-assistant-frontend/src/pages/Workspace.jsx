
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../services/api";

function Workspace({
    userName,
    documents,
    activeChat,
    onSaveChat,
    onRefreshConversation,
    onUpload,
}) {
    const location = useLocation();
    const navigate = useNavigate();

    const [prompt, setPrompt] = useState("");
    const [messages, setMessages] = useState([]);
    const [title, setTitle] = useState("New chat");
    const [tool, setTool] = useState("");

    const [selectedDocumentId, setSelectedDocumentId] = useState("");
    const [selectedDocuments, setSelectedDocuments] = useState([]);

    const [difficulty, setDifficulty] = useState("Medium");
    const [questionCount, setQuestionCount] = useState("10");

    // Store selected answers for each quiz.
    const [quizAnswers, setQuizAnswers] = useState({});

    // Track which quizzes have been submitted.
    const [submittedQuizzes, setSubmittedQuizzes] = useState({});
    const [uploading, setUploading] = useState(false);
    const [sending, setSending] = useState(false);

    const [uploadError, setUploadError] = useState("");
    const [chatError, setChatError] = useState("");

    const fileRef = useRef(null);
    const autoSubmittedPromptRef = useRef(null);

    const validDocuments = documents.filter(
        (document) => document.status !== "failed"
    );

    // Restore the selected chat when navigating to the workspace.
  
    // Restore the selected chat and handle prompts from the home page.
    useEffect(() => {
        const state = location.state || {};

        if (state.prompt || state.tool) {
            setTool(state.tool || "");

            setTitle(
                state.tool ||
                    (state.prompt
                        ? state.prompt.slice(0, 34)
                        : "New chat")
            );

            setMessages([]);
            setSelectedDocumentId("");

            const initialSelectedDocuments = (
                state.selectedDocumentIds || []
            )
                .map((documentId) =>
                    validDocuments.find(
                        (document) =>
                            String(document.id) === String(documentId)
                    )
                )
                .filter(Boolean);

            setSelectedDocuments(initialSelectedDocuments);
            setUploadError("");
            setChatError("");
            setPrompt(state.prompt || "");

            // Automatically submit ordinary questions from the home page.
            if (state.prompt && !state.tool) {
                const submissionKey = location.key;

                if (autoSubmittedPromptRef.current !== submissionKey) {
                    autoSubmittedPromptRef.current = submissionKey;

                    sendMessage(
                        { preventDefault: () => {} },
                        {
                            promptOverride: state.prompt,
                            documentIdsOverride:
                                state.selectedDocumentIds || [],
                        }
                    );
                }
            }
        } else if (activeChat && activeChat.messages) {
            setMessages(activeChat.messages);
            setTitle(activeChat.title || "Study chat");
            setTool(activeChat.tool || "");
            setPrompt("");
            setSelectedDocumentId("");
            setSelectedDocuments([]);
            setUploadError("");
            setChatError("");
        } else {
            setMessages([]);
            setTitle("New chat");
            setTool("");
            setPrompt("");
            setSelectedDocuments([]);
            setChatError("");
        }
    }, [location.key]);



    function openFilePicker() {
        if (!uploading) {
            fileRef.current?.click();
        }
    }

    // Upload documents using the existing Django upload function.
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
                "Document upload error:",
                error.response?.data || error.message
            );

            const responseData = error.response?.data;

            setUploadError(
                typeof responseData === "string"
                    ? responseData
                    : responseData
                      ? JSON.stringify(responseData)
                      : error.message || "Document upload failed."
            );
        } finally {
            setUploading(false);
            input.value = "";
        }
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

    // Create a Django conversation if this is a new chat.
    async function createConversation(chatTitle) {
        const response = await api.post("chat/conversations/", {
            title: chatTitle,
        });

        const conversation = response.data.conversation || response.data;

        if (!conversation.id) {
            throw new Error(
                "The conversation API did not return an ID. Check the Django response."
            );
        }

        return conversation.id;
    }

    // Send a message to the Django RAG backend.
    
    async function sendMessage(event, options = {}) {
        event?.preventDefault();

        const question = (
            options.promptOverride ?? prompt
        ).trim();

        if (!question || sending) return;

        const documentIds =
            options.documentIdsOverride ??
            selectedDocuments.map((document) => document.id);



        const currentSelectedDocuments = documentIds
            .map((documentId) =>
                validDocuments.find(
                    (document) =>
                        String(document.id) === String(documentId)
                )
            )
            .filter(Boolean);

        // The current backend API accepts one document ID per request.
        const selectedDocument = currentSelectedDocuments[0];

        const settings = /mcq/i.test(tool)
            ? `\nGenerate ${questionCount} questions at ${difficulty} difficulty.`
            : "";

        const userMessage = {
            role: "user",
            text: question + settings,
        };

        const updatedMessages = [...messages, userMessage];

        setMessages(updatedMessages);
        setPrompt("");
        setSending(true);
        setChatError("");

        const nextTitle =
            title === "New chat"
                ? question.slice(0, 34)
                : title;

        setTitle(nextTitle);

        try {
            let conversationId =
                activeChat?.backendId ||
                (
                    activeChat?.id &&
                    Number.isInteger(Number(activeChat.id)) &&
                    !activeChat.isTemporary
                        ? activeChat.id
                        : null
                );

            if (!conversationId) {
                conversationId = await createConversation(nextTitle);
            }

            const requestData = {
              content: question,
              document_ids: currentSelectedDocuments.map(
                (document) => document.id
              ),
            };

            // MCQ generation.
            if (tool === "Generate MCQs") {
                requestData.tool = "mcq";
                requestData.question_count = Number(questionCount);
                requestData.difficulty = difficulty;
            }

            // Document summarization.
            else if (tool === "Summarize") {
                requestData.tool = "summarize";
            }



            const response = await api.post(
                `chat/conversations/${conversationId}/messages/`,
                requestData
            );

            const replyContent = response.data.reply?.content;

            if (!replyContent) {
                throw new Error(
                    "The backend response did not contain reply.content."
                );
            }

            let mcqData = null;

            if (tool === "Generate MCQs") {
                try {
                    mcqData = JSON.parse(replyContent);

                    if (
                        !mcqData ||
                        !Array.isArray(mcqData.questions) ||
                        mcqData.questions.length === 0
                    ) {
                        throw new Error("Invalid MCQ response.");
                    }
                } catch (error) {
                    throw new Error(
                        "The MCQs were generated, but their response could not be displayed. Please try again."
                    );
                }
            }

            const assistantMessage = {
                role: "assistant",
                text: replyContent,
                mcq: mcqData,
                source: response.data.reply?.sources?.length
                    ? "Sources retrieved from your documents"
                    : "",
            };

            const completedMessages = [
                ...updatedMessages,
                assistantMessage,
            ];
            // Display the answer immediately in the current workspace.
            setMessages(completedMessages);

            onSaveChat({
                id: conversationId,
                backendId: conversationId,
                title: nextTitle,
                tool,
                messages: completedMessages,
            });

            // Refresh the conversation from Django so its saved messages,
            // title, and timestamps remain synchronized.
            if (onRefreshConversation) {
                try {
                    await onRefreshConversation(conversationId);
                } catch (error) {
                    console.error(
                        "Unable to refresh saved conversation:",
                        error.response?.data || error.message
                    );
                }
            }
        } catch (error) {
            console.error(
                "Chat request failed:",
                error.response?.data || error.message
            );

            setChatError(
                error.response?.data?.detail ||
                    error.response?.data?.error ||
                    JSON.stringify(error.response?.data || {}) ||
                    error.message ||
                    "Unable to get an answer from Studora."
            );
        } finally {
            setSending(false);
            window.history.replaceState({}, "");
        }
    }
    function selectQuizAnswer(messageIndex, questionIndex, label) {
    if (submittedQuizzes[messageIndex]) return;

    setQuizAnswers((previous) => ({
        ...previous,
        [messageIndex]: {
            ...(previous[messageIndex] || {}),
            [questionIndex]: label,
        },
    }));
}

function submitQuiz(messageIndex) {
    const message = messages[messageIndex];

    if (!message?.mcq?.questions) return;

    const answers = quizAnswers[messageIndex] || {};
    const totalQuestions = message.mcq.questions.length;

    const answeredCount = message.mcq.questions.filter(
        (_, index) => answers[index]
    ).length;

    if (answeredCount !== totalQuestions) {
        setChatError(
            `Please answer all ${totalQuestions} questions before submitting.`
        );
        return;
    }

    setChatError("");
    setSubmittedQuizzes((previous) => ({
        ...previous,
        [messageIndex]: true,
    }));
}

function retryQuiz(messageIndex) {
    setQuizAnswers((previous) => {
        const updated = { ...previous };
        delete updated[messageIndex];
        return updated;
    });

    setSubmittedQuizzes((previous) => {
        const updated = { ...previous };
        delete updated[messageIndex];
        return updated;
    });

    setChatError("");
}
    return (
        <section className="workspace-page">
            <div className="workspace-heading">
                <div>
                    <button
                        type="button"
                        className="back-button"
                        onClick={() => navigate("/")}
                    >
                        <i className="bi bi-arrow-left"></i> Home
                    </button>

                        <h1 className="workspace-chat-title">{title}</h1>
                </div>

                {tool && (
                    <span className="tool-pill">
                        <i className="bi bi-stars"></i> {tool}
                    </span>
                )}
            </div>

            <div className="workspace-tool-selector">
                <button
                    type="button"
                    className={`tool-selector-btn ${!tool || tool === "General Asking" || tool === "Chat" ? "active" : ""}`}
                    onClick={() => setTool("General Asking")}
                >
                    <i className="bi bi-chat-dots"></i> General Asking
                </button>
                <button
                    type="button"
                    className={`tool-selector-btn ${tool === "Ask questions" ? "active" : ""}`}
                    onClick={() => setTool("Ask questions")}
                >
                    <i className="bi bi-chat-square-text"></i> Ask Questions
                </button>
                <button
                    type="button"
                    className={`tool-selector-btn ${tool === "Generate MCQs" ? "active" : ""}`}
                    onClick={() => setTool("Generate MCQs")}
                >
                    <i className="bi bi-ui-checks-grid"></i> Generate MCQs
                </button>
                <button
                    type="button"
                    className={`tool-selector-btn ${tool === "Summarize" ? "active" : ""}`}
                    onClick={() => setTool("Summarize")}
                >
                    <i className="bi bi-journal-text"></i> Summarize
                </button>
            </div>

            {tool &&
                ["Summarize", "Ask questions", "Generate MCQs"].includes(
                    tool
                ) && (
                    <div className="study-tool-options">
                        <div className="study-option-row">
                            <label
                                className="study-option-label"
                                htmlFor="uploaded-document"
                            >
                                Choose from uploaded documents
                            </label>

                            <select
                                id="uploaded-document"
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
                                onClick={openFilePicker}
                                disabled={uploading}
                            >
                                <i className="bi bi-paperclip"></i>{" "}
                                {uploading
                                    ? "Uploading..."
                                    : "Choose files"}
                            </button>
                        </div>

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
                                    {selectedDocuments
                                        .filter((selectedDocument) =>
                                            validDocuments.some(
                                                (document) =>
                                                    String(document.id) ===
                                                    String(selectedDocument.id)
                                            )
                                        )
                                        .map((document) => (
                                            <div
                                                className="selected-document"
                                                key={document.id}
                                            >
                                                <i className="bi bi-file-earmark-text"></i>

                                                <span className="selected-document-name">
                                                    {document.title ||
                                                        document.name}
                                                </span>

                                                <button
                                                    type="button"
                                                    className="remove-document"
                                                    onClick={() =>
                                                        removeDocument(
                                                            document.id
                                                        )
                                                    }
                                                    title="Remove document"
                                                    aria-label={`Remove ${
                                                        document.title ||
                                                        document.name
                                                    }`}
                                                >
                                                    <i className="bi bi-x-lg"></i>
                                                </button>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}

                        {tool === "Generate MCQs" && (
                            <div className="study-mcq-settings">
                                <div className="study-option-row">
                                    <label
                                        className="study-option-label"
                                        htmlFor="question-count"
                                    >
                                        Number of questions
                                    </label>

                                    <select
                                        id="question-count"
                                        className="study-option-control"
                                        value={questionCount}
                                        onChange={(event) =>
                                            setQuestionCount(
                                                event.target.value
                                            )
                                        }
                                    >
                                        <option value="5">5 questions</option>
                                        <option value="10">10 questions</option>
                                        <option value="15">15 questions</option>
                                        <option value="20">20 questions</option>
                                        <option value="25">25 questions</option>
                                    </select>
                                </div>

                                <div className="study-option-row">
                                    <label
                                        className="study-option-label"
                                        htmlFor="question-difficulty"
                                    >
                                        Difficulty level
                                    </label>

                                    <select
                                        id="question-difficulty"
                                        className="study-option-control"
                                        value={difficulty}
                                        onChange={(event) =>
                                            setDifficulty(event.target.value)
                                        }
                                    >
                                        <option>Easy</option>
                                        <option>Medium</option>
                                        <option>Hard</option>
                                        <option>Mixed</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {validDocuments.length === 0 && (
                            <p className="study-option-hint">
                                No usable documents yet. Upload a PDF or TXT
                                file.
                            </p>
                        )}
                    </div>
                )}

            <input
                ref={fileRef}
                type="file"
                multiple
                hidden
                accept=".pdf,.txt"
                onChange={handleUpload}
            />

            <div className="workspace-content">
                {chatError && (
                    <div className="alert alert-danger" role="alert">
                        {chatError}
                    </div>
                )}

                {messages.length > 0 && (
                    <div className="workspace-messages">
                        {messages.map((message, index) => (
                            <div
                                key={`${index}-${message.role}`}
                                className={`workspace-message ${
                                    message.role === "user"
                                        ? "user-message"
                                        : "assistant-message"
                                }`}
                            >
                                <div className="message-role">
                                    {message.role === "user"
                                        ? "You"
                                        : "Studora"}
                                </div>

                                {message.role === "assistant" && message.mcq ? (
    <div className="mcq-quiz">
        <div className="mcq-quiz-header">
            <div>
                <h3>
                    <i className="bi bi-patch-question-fill"></i>{" "}
                    Practice Quiz
                </h3>

                <p>
                    {message.mcq.question_count} questions ·{" "}
                    {message.mcq.difficulty} difficulty
                </p>
            </div>

            <span className="mcq-quiz-badge">
                <i className="bi bi-stars"></i> STUDORA
            </span>
        </div>

        {message.mcq.questions.map((question, questionIndex) => {
            const selectedAnswer =
                quizAnswers[index]?.[questionIndex];

            const submitted = Boolean(submittedQuizzes[index]);

            const isCorrect =
                selectedAnswer === question.correct_answer;

            return (
                <div
                    className="mcq-question-card"
                    key={`${index}-${questionIndex}`}
                >
                    <div className="mcq-question-top">
                        <span className="mcq-question-number">
                            Question {questionIndex + 1}
                        </span>

                        <span
                            className={`mcq-difficulty mcq-difficulty-${(
                                question.difficulty || "Medium"
                            ).toLowerCase()}`}
                        >
                            {question.difficulty || "Medium"}
                        </span>
                    </div>

                    <h4>{question.question}</h4>

                    <div className="mcq-options">
                        {question.options.map((option) => {
                            const isSelected =
                                selectedAnswer === option.label;

                            const isAnswer =
                                question.correct_answer === option.label;

                            let optionClass = "";

                            if (submitted && isAnswer) {
                                optionClass = "correct";
                            } else if (
                                submitted &&
                                isSelected &&
                                !isAnswer
                            ) {
                                optionClass = "incorrect";
                            } else if (isSelected) {
                                optionClass = "selected";
                            }

                            return (
                                <button
                                    key={option.label}
                                    type="button"
                                    className={`mcq-option ${optionClass}`}
                                    onClick={() =>
                                        selectQuizAnswer(
                                            index,
                                            questionIndex,
                                            option.label
                                        )
                                    }
                                    disabled={submitted}
                                    aria-pressed={isSelected}
                                >
                                    <span className="mcq-option-label">
                                        {option.label}
                                    </span>

                                    <span className="mcq-option-text">
                                        {option.text}
                                    </span>

                                    {submitted && isAnswer && (
                                        <i className="bi bi-check-circle-fill mcq-option-icon"></i>
                                    )}

                                    {submitted &&
                                        isSelected &&
                                        !isAnswer && (
                                            <i className="bi bi-x-circle-fill mcq-option-icon"></i>
                                        )}
                                </button>
                            );
                        })}
                    </div>

                    {submitted && (
                        <div
                            className={`mcq-feedback ${
                                isCorrect ? "feedback-correct" : "feedback-incorrect"
                            }`}
                        >
                            <strong>
                                <i
                                    className={`bi ${
                                        isCorrect
                                            ? "bi-check-circle-fill"
                                            : "bi-info-circle-fill"
                                    }`}
                                ></i>{" "}
                                {isCorrect
                                    ? "Correct answer!"
                                    : `Incorrect. Correct answer: ${question.correct_answer}`}
                            </strong>

                            <p>{question.explanation}</p>
                        </div>
                    )}
                </div>
            );
        })}

        {!submittedQuizzes[index] ? (
            <button
                type="button"
                className="mcq-submit-button"
                onClick={() => submitQuiz(index)}
            >
                Check My Answers
                <i className="bi bi-arrow-right"></i>
            </button>
        ) : (
            <div className="mcq-results">
                <div className="mcq-results-icon">
                    <i className="bi bi-trophy-fill"></i>
                </div>

                <h3>Quiz Completed!</h3>

                <p className="mcq-score">
                    {
                        message.mcq.questions.filter(
                            (question, questionIndex) =>
                                quizAnswers[index]?.[questionIndex] ===
                                question.correct_answer
                        ).length
                    }{" "}
                    / {message.mcq.questions.length}
                </p>

                <p className="mcq-results-caption">
                    {
                        Math.round(
                            (
                                message.mcq.questions.filter(
                                    (question, questionIndex) =>
                                        quizAnswers[index]?.[questionIndex] ===
                                        question.correct_answer
                                ).length /
                                message.mcq.questions.length
                            ) * 100
                        )
                    }
                    % correct
                </p>

                <button
                    type="button"
                    className="mcq-retry-button"
                    onClick={() => retryQuiz(index)}
                >
                    <i className="bi bi-arrow-repeat"></i> Retry Quiz
                </button>
            </div>
        )}
    </div>
) : (
    <p>{message.text}</p>
)}

                                {message.source && (
                                    <small className="message-source">
                                        {message.source}
                                    </small>
                                )}
                            </div>
                        ))}

                        {sending && (
                            <div className="workspace-message assistant-message">
                                <div className="message-role">Studora</div>
                                <p>Thinking...</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <form className="chat-prompt" onSubmit={sendMessage}>
                <textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    rows="2"
                    placeholder="Message Studora..."
                    disabled={sending}
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

                <div className="chat-prompt-footer">
                    <div>
                        <button
                            type="button"
                            className="attach-button"
                            onClick={openFilePicker}
                            disabled={uploading || sending}
                        >
                            <i className="bi bi-paperclip"></i>{" "}
                            {uploading ? "Uploading..." : "Attach"}
                        </button>
                    </div>

                    <button
                        className="send-button"
                        type="submit"
                        aria-label="Send message"
                        disabled={sending || !prompt.trim()}
                    >
                        {sending ? (
                            <span
                                className="spinner-border spinner-border-sm"
                                role="status"
                                aria-label="Sending"
                            ></span>
                        ) : (
                            <i className="bi bi-arrow-up"></i>
                        )}
                    </button>
                </div>
            </form>

            <p className="workspace-disclaimer">
                AI answers can be wrong. Check important information.
            </p>
        </section>
    );
}

export default Workspace;

