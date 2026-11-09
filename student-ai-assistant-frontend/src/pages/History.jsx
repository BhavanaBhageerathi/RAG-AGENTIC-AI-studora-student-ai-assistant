
import { useNavigate } from "react-router-dom";

function History({ chats, onOpen, onDelete }) {
    const navigate = useNavigate();

    async function openChat(chat) {
        await onOpen(chat);
        navigate("/workspace");
    }

    async function handleDelete(event, chat) {
        // Prevent the row's open-chat action from running.
        event.stopPropagation();

        const confirmed = window.confirm(
            `Are you sure you want to delete "${chat.title}"?`
        );

        if (!confirmed) return;

        await onDelete(chat.id);
    }

    return (
        <section className="simple-page">
            <div className="page-heading-row">
                <div>
                    <p className="eyebrow">
                        PICK UP WHERE YOU LEFT OFF
                    </p>

                    <h1>Chat history</h1>
                </div>
            </div>

            {chats.length === 0 ? (
                <div className="empty-state history-empty">
                    <div className="empty-state-icon">
                        <i className="bi bi-clock-history"></i>
                    </div>

                    <h3>No chats yet</h3>

                    <p>Your conversations will show up here.</p>

                    <button
                        className="primary-button"
                        onClick={() => navigate("/")}
                    >
                        Start a chat
                    </button>
                </div>
            ) : (
                <div className="history-list">
                    {chats.map((chat) => {
                        const userMessages = (
                            chat.messages || []
                        ).filter(
                            (message) => message.role === "user"
                        );

                        return (
                            <div
                                className="history-item"
                                key={chat.id}
                            >
                                <button
                                    type="button"
                                    className="history-open-button"
                                    onClick={() => openChat(chat)}
                                >
                                    <span className="history-icon">
                                        <i className="bi bi-chat-left-text"></i>
                                    </span>

                                    <span className="history-details">
                                        <strong>{chat.title}</strong>

                                        <small>
                                            {userMessages.length}{" "}
                                            {userMessages.length === 1
                                                ? "message"
                                                : "messages"}
                                        </small>
                                    </span>
                                </button>

                                <div className="history-actions">
                                    <button
                                        type="button"
                                        className="history-delete-button"
                                        title="Delete conversation"
                                        aria-label={`Delete ${chat.title}`}
                                        onClick={(event) =>
                                            handleDelete(event, chat)
                                        }
                                    >
                                        <i className="bi bi-trash3"></i>
                                    </button>

                                    <button
                                        type="button"
                                        className="history-arrow-button"
                                        title="Open conversation"
                                        aria-label={`Open ${chat.title}`}
                                        onClick={() => openChat(chat)}
                                    >
                                        <i className="bi bi-chevron-right"></i>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

export default History;

