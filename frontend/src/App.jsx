import React, { useState } from "react";
import { ConversationsPage } from "./pages/ConversationsPage";
import { ConversationDetailPage } from "./pages/ConversationDetailPage";
import { EvaluationsPage } from "./pages/EvaluationsPage";
import { FailureModesPage } from "./pages/FailureModesPage";
import { ModelsPage } from "./pages/ModelsPage";
import { ActionsPage } from "./pages/ActionsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ScoresPage } from "./pages/ScoresPage";
import { LLMJudgePage } from "./pages/LLMJudgePage";
import { HumanAnnotationPage } from "./pages/HumanAnnotationPage";
import { DatasetsPage } from "./pages/DatasetsPage";
import { TrendsPage } from "./pages/TrendsPage";
import { ToolCallsPage } from "./pages/ToolCallsPage";
import { DashboardPage } from "./pages/DashboardPage";

import { TracesPage } from "./pages/TracesPage";
import { TraceDetailPage } from "./pages/TraceDetailPage";
import { Sidebar } from "./components/layout/Sidebar";
import { SidebarProvider, useSidebar } from "./context/SidebarContext";

function AppContent() {
    const [activeTab, setActiveTab] = useState("dashboard");
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [selectedTrace, setSelectedTrace] = useState(null);
    const { sidebarWidth } = useSidebar();

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
            case "dashboard":
                return <DashboardPage />;
            case "conversations":
                return (
                    <ConversationsPage onSelectConversation={setSelectedConversation} />
                );

            case "traces":
                if (selectedTrace) {
                    return (
                        <TraceDetailPage
                            traceId={selectedTrace}
                            onBack={() => setSelectedTrace(null)}
                        />
                    );
                }
                return <TracesPage onSelectTrace={setSelectedTrace} />;
            case "scores":
                return <ScoresPage />;
            case "llm-judge":
                return <LLMJudgePage />;
            case "human-annotation":
                return <HumanAnnotationPage />;
            case "datasets":
                return <DatasetsPage />;
            case "evaluations":
                return <EvaluationsPage />;
            case "trends":
                return <TrendsPage />;
            case "tool-calls":
                return <ToolCallsPage />;
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

            <main
                style={{ marginLeft: `${sidebarWidth}px` }}
                className="min-h-screen transition-all duration-300 ease-in-out"
            >
                <div className="w-full px-8 py-8">
                    {renderPage()}
                </div>
            </main>
        </div>
    );
}

function App() {
    return (
        <SidebarProvider>
            <AppContent />
        </SidebarProvider>
    );
}

export default App;
