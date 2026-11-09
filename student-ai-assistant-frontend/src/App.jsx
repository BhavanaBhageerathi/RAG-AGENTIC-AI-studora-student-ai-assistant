
import { useCallback, useEffect, useState } from "react";
import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
} from "react-router-dom";

import api from "./services/api";

import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Workspace from "./pages/Workspace";
import Documents from "./pages/Documents";
import History from "./pages/History";

function App() {
    const [loggedIn, setLoggedIn] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);
    const [userName, setUserName] = useState("Student");

    const [documents, setDocuments] = useState([]);
    const [chats, setChats] = useState([]);
    const [activeChat, setActiveChat] = useState(null);

    // Load documents belonging to the logged-in user.
    const loadDocuments = useCallback(async () => {
        const response = await api.get("documents/");

        const savedDocuments = response.data.map((document) => ({
            ...document,
            name: document.title || document.name,
            size: document.size || 0,
        }));

        setDocuments(savedDocuments);

        return savedDocuments;
    }, []);

    // Load saved conversations, including their messages.
    const loadChats = useCallback(async () => {
        const response = await api.get("chat/history/");

        const conversations = response.data.results ?? response.data;

        const savedChats = conversations.map((conversation) => ({
            id: conversation.id,
            backendId: conversation.id,
            title: conversation.title || "New Chat",
            created_at: conversation.created_at,
            updated_at: conversation.updated_at,
            messages: (conversation.messages || []).map((message) => ({
                id: message.id,
                role: message.role,
                text: message.content,
                content: message.content,
                sources: message.sources || [],
                source: message.sources?.length
                    ? "Sources retrieved from your documents"
                    : "",
                created_at: message.created_at,
            })),
        }));

        setChats(savedChats);

        return savedChats;
    }, []);

    // Check whether the existing login session is valid.
    useEffect(() => {
        let cancelled = false;

        async function checkLogin() {
            const token = localStorage.getItem("access_token");

            if (!token) {
                setAuthLoading(false);
                return;
            }

            try {
                let userResponse;

                try {
                    userResponse = await api.get("auth/me/");
                } catch (error) {
                    const refresh = localStorage.getItem("refresh_token");

                    if (!refresh) {
                        throw error;
                    }

                    const refreshResponse = await api.post(
                        "auth/token/refresh/",
                        { refresh }
                    );

                    localStorage.setItem(
                        "access_token",
                        refreshResponse.data.access
                    );

                    userResponse = await api.get("auth/me/");
                }

                if (cancelled) return;

                setUserName(
                    userResponse.data.username ||
                    userResponse.data.first_name ||
                    "Student"
                );

                setLoggedIn(true);

                await Promise.all([
                    loadDocuments(),
                    loadChats(),
                ]);
            } catch (error) {
                console.error(
                    "Unable to restore session:",
                    error.response?.data || error.message
                );

                if (!cancelled) {
                    localStorage.removeItem("access_token");
                    localStorage.removeItem("refresh_token");

                    setLoggedIn(false);
                    setDocuments([]);
                    setChats([]);
                    setActiveChat(null);
                }
            } finally {
                if (!cancelled) {
                    setAuthLoading(false);
                }
            }
        }

        checkLogin();

        return () => {
            cancelled = true;
        };
    }, [loadDocuments, loadChats]);

    // Log in.
    async function handleLogin(username, password) {
        const response = await api.post("auth/login/", {
            username,
            password,
        });

        localStorage.setItem("access_token", response.data.access);
        localStorage.setItem("refresh_token", response.data.refresh);

        try {
            const userResponse = await api.get("auth/me/");

            setUserName(
                userResponse.data.username ||
                userResponse.data.first_name ||
                username
            );
        } catch {
            setUserName(username);
        }

        setLoggedIn(true);

        await Promise.all([
            loadDocuments(),
            loadChats(),
        ]);
    }

    // Upload documents through Django.
    async function addDocuments(files) {
        const uploadedDocuments = [];

        for (const file of files) {
            const formData = new FormData();

            formData.append("file", file);

            formData.append(
                "title",
                file.name.replace(/\.[^/.]+$/, "")
            );

            const response = await api.post(
                "documents/",
                formData,
                { timeout: 60000 }
            );

            const document = response.data;

            uploadedDocuments.push({
                ...document,
                name: document.title || file.name,
                size: document.size || file.size,
            });
        }

        setDocuments((previousDocuments) => {
            const existingIds = new Set(
                previousDocuments.map((document) => String(document.id))
            );

            const newDocuments = uploadedDocuments.filter(
                (document) => !existingIds.has(String(document.id))
            );

            return [...newDocuments, ...previousDocuments];
        });

        return uploadedDocuments;
    }

    // Refresh one conversation from Django after a message is sent.
    async function refreshConversation(conversationId) {
        const response = await api.get(
            `chat/conversations/${conversationId}/`
        );

        const conversation = response.data;

        const savedChat = {
            id: conversation.id,
            backendId: conversation.id,
            title: conversation.title || "New Chat",
            created_at: conversation.created_at,
            updated_at: conversation.updated_at,
            messages: (conversation.messages || []).map((message) => ({
                id: message.id,
                role: message.role,
                text: message.content,
                content: message.content,
                sources: message.sources || [],
                source: message.sources?.length
                    ? "Sources retrieved from your documents"
                    : "",
                created_at: message.created_at,
            })),
        };

        setChats((previousChats) => [
            savedChat,
            ...previousChats.filter(
                (chat) => String(chat.id) !== String(savedChat.id)
            ),
        ]);

        setActiveChat(savedChat);

        return savedChat;
    }

    // Save a chat after sending a message.
    function saveChat(chat) {
        setChats((previousChats) => {
            const exists = previousChats.some(
                (item) => String(item.id) === String(chat.id)
            );

            if (exists) {
                return previousChats.map((item) =>
                    String(item.id) === String(chat.id)
                        ? { ...item, ...chat }
                        : item
                );
            }

            return [chat, ...previousChats];
        });

        setActiveChat(chat);
    }

    // Open a conversation and retrieve its latest saved messages.
    async function openChat(chat) {
        if (!chat?.id) return;

        try {
            await refreshConversation(chat.backendId || chat.id);
        } catch (error) {
            console.error(
                "Unable to open conversation:",
                error.response?.data || error.message
            );

            // Use the already-loaded messages if refreshing fails.
            setActiveChat(chat);
        }
    }
    
    // Delete a conversation from Django and update the UI.
    async function deleteChat(chatId) {
        try {
            await api.delete(`chat/conversations/${chatId}/`);

            setChats((previousChats) =>
                previousChats.filter(
                    (chat) => String(chat.id) !== String(chatId)
                )
            );

            setActiveChat((previousChat) =>
                previousChat &&
                String(previousChat.id) === String(chatId)
                    ? null
                    : previousChat
            );
        } catch (error) {
            console.error(
                "Unable to delete conversation:",
                error.response?.data || error.message
            );

            alert("Unable to delete this conversation. Please try again.");
        }
    }



    function startNewChat() {
        setActiveChat(null);
    }

    // Log out without deleting the saved Django conversations.
    function handleLogout() {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");

        setLoggedIn(false);
        setUserName("Student");

        setActiveChat(null);
        setDocuments([]);
        setChats([]);
    }

    if (authLoading) {
        return (
            <div className="auth-loading">
                Loading Studora...
            </div>
        );
    }

   
    return (
        <BrowserRouter>
            <Routes>
                {/* Login page */}
                <Route
                    path="/login"
                    element={
                        loggedIn ? (
                            <Navigate to="/" replace />
                        ) : (
                            <Login onLogin={handleLogin} />
                        )
                    }
                />

                {/* Registration page */}
                <Route
                    path="/register"
                    element={
                        loggedIn ? (
                            <Navigate to="/" replace />
                        ) : (
                            <Register onLogin={handleLogin} />
                        )
                    }
                />

                {/* Protected application layout */}
                <Route
                    path="/"
                    element={
                        <ProtectedRoute loggedIn={loggedIn}>
                            <Layout
                                userName={userName}
                                onLogout={handleLogout}
                                onNewChat={startNewChat}
                            />
                        </ProtectedRoute>
                    }
                >
                    {/* Dashboard */}
                    <Route
                        index
                        element={
                            <Dashboard
                                documents={documents}
                                onUpload={addDocuments}
                                onStart={(tool) => {
                                    setActiveChat({
                                        id: `temporary-${Date.now()}`,
                                        title: tool,
                                        messages: [],
                                        tool,
                                        isTemporary: true,
                                    });
                                }}
                            />
                        }
                    />

                    {/* Workspace */}
                    <Route
                        path="workspace"
                        element={
                            <Workspace
                                userName={userName}
                                documents={documents}
                                activeChat={activeChat}
                                onSaveChat={saveChat}
                                onRefreshConversation={refreshConversation}
                                onUpload={addDocuments}
                            />
                        }
                    />

                    {/* Documents */}
                    <Route
                        path="documents"
                        element={
                            <Documents
                                documents={documents}
                                onUpload={addDocuments}
                                setDocuments={setDocuments}
                            />
                        }
                    />

                    {/* Chat history */}
                    <Route
                        path="history"
                        element={
                            <History
                                chats={chats}
                                onOpen={openChat}
                                onDelete={deleteChat}
                            />
                        }
                    />
                </Route>

                {/* Redirect unknown routes */}
                <Route
                    path="*"
                    element={
                        <Navigate
                            to={loggedIn ? "/" : "/login"}
                            replace
                        />
                    }
                />
            </Routes>
        </BrowserRouter>
    );
}
export default App;