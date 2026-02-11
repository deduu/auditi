/*
 * Copyright (c) 2026 Auditi Contributors
 *
 * MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

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
import { LoginPage } from "./pages/LoginPage";
import { SetupPage } from "./pages/SetupPage";
import { Sidebar } from "./components/layout/Sidebar";
import { SidebarProvider, useSidebar } from "./context/SidebarContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ErrorBoundary from "./components/common/ErrorBoundary";

function AuthenticatedApp() {
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
                return <DashboardPage onNavigate={setActiveTab} />;
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
                return <ModelsPage onNavigate={setActiveTab} />;
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
                    <ErrorBoundary>
                        {renderPage()}
                    </ErrorBoundary>
                </div>
            </main>
        </div>
    );
}

function AppContent() {
    const { isAuthenticated, isLoading, setupRequired } = useAuth();

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (setupRequired) {
        return <SetupPage />;
    }

    if (!isAuthenticated) {
        return <LoginPage />;
    }

    return (
        <SidebarProvider>
            <AuthenticatedApp />
        </SidebarProvider>
    );
}

function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}

export default App;
