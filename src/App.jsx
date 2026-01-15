import React, { useState } from "react";
import {
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  Zap,
  FileText,
  Settings,
} from "lucide-react";
import { ConversationsPage } from "./pages/ConversationsPage";
import { ConversationDetailPage } from "./pages/ConversationDetailPage";
import { EvaluationsPage } from "./pages/EvaluationsPage";
import { FailureModesPage } from "./pages/FailureModesPage";
import { ModelsPage } from "./pages/ModelsPage";
import { ActionsPage } from "./pages/ActionsPage";
import { SettingsPage } from "./pages/SettingsPage";

function App() {
  const [activeTab, setActiveTab] = useState("conversations");
  const [selectedConversation, setSelectedConversation] = useState(null);

  const tabs = [
    { id: "conversations", label: "Conversations", icon: MessageSquare },
    { id: "evaluations", label: "Evaluations", icon: CheckCircle },
    { id: "failure-modes", label: "Failure Modes", icon: AlertTriangle },
    { id: "models", label: "Models", icon: Zap },
    { id: "actions", label: "Recommended Actions", icon: FileText },
    { id: "settings", label: "Settings", icon: Settings },
  ];

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
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="w-full px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center space-x-2 shrink-0">
              <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-base font-semibold text-gray-900 whitespace-nowrap">
                AI Agent Monitor
              </span>
            </div>
            <div className="flex items-center space-x-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 whitespace-nowrap ${
                      activeTab === tab.id
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 mr-1.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </nav>
      <main className="w-full px-6 py-8">{renderPage()}</main>
    </div>
  );
}

export default App;
