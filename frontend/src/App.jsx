import React, { useState } from "react";
import { ConversationsPage } from "./pages/ConversationsPage";
import { ConversationDetailPage } from "./pages/ConversationDetailPage";
import { EvaluationsPage } from "./pages/EvaluationsPage";
import { FailureModesPage } from "./pages/FailureModesPage";
import { ModelsPage } from "./pages/ModelsPage";
import { ActionsPage } from "./pages/ActionsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { Sidebar } from "./components/layout/Sidebar";

function App() {
    const [activeTab, setActiveTab] = useState("conversations");
    const [selectedConversation, setSelectedConversation] = useState(null);

    const renderPage = () => {
        if (activeTab === "conversations" && selectedConversation) {
            return (
                <ConversationDetailPage
                    conversationId={selectedConversation}
                    onBack={() => setSelectedConversation(null)}
                />
            );
        }

        switch (activeTab) {
            case "conversations":
                return (
                    <ConversationsPage onSelectConversation={setSelectedConversation} />
                );
            case "evaluations":
                return <EvaluationsPage />;
            case "failure-modes":
                return <FailureModesPage />;
            case "models":
                return <ModelsPage />;
            case "actions":
                return <ActionsPage />;
            case "settings":
                return <SettingsPage />;
            default:
                return (
                    <ConversationsPage onSelectConversation={setSelectedConversation} />
                );
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30">
            <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

            <main className="ml-64 min-h-screen transition-all duration-300 ease-in-out">
                <div className="w-full px-8 py-8">
                    {renderPage()}
                </div>
            </main>
        </div>
    );
}

export default App;
