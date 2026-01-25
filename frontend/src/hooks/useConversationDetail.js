import { useState, useEffect } from "react";
import api from "../api";

// Mock detailed session data with conversation turns and evaluations
const mockSessionDetails = {
  session_001: {
    id: "session_001",
    userId: "user_001",
    startTime: "2024-01-15T14:30:00Z",
    endTime: "2024-01-15T14:45:00Z",
    objective: "Get help with billing inquiry",
    models: ["GPT-4", "Claude"],
    overallStatus: "review",
    avgScore: 7.8,
    turns: [
      {
        id: "turn_1",
        user: { content: "Hi, I have a question about my recent bill. It seems higher than usual." },
        assistant: {
          content: "Hello! I'd be happy to help you review your bill. Could you please provide your account number or the billing period you're concerned about?",
          model: "GPT-4",
          latency: "1.2s",
          evaluation: {
            status: "pass",
            score: 9.0,
            failureMode: null,
            reason: "Appropriate greeting, clear request for needed information, professional tone.",
            recommendedAction: null,
          },
        },
      },
      {
        id: "turn_2",
        user: { content: "My account is 12345. The bill is for December 2024." },
        assistant: {
          content: "Thank you! I can see your December bill is $150.00, which is $30 higher than November. This increase is due to the premium feature you activated on December 5th.",
          model: "GPT-4",
          latency: "2.1s",
          evaluation: {
            status: "pass",
            score: 8.5,
            failureMode: null,
            reason: "Accurate information retrieval, clear explanation of the difference.",
            recommendedAction: null,
          },
        },
      },
      {
        id: "turn_3",
        user: { content: "I don't remember activating any premium feature. Can you tell me more?" },
        assistant: {
          content: "The premium feature was activated from your mobile app. It includes advanced analytics and priority support. Would you like me to deactivate it?",
          model: "Claude",
          latency: "1.8s",
          evaluation: {
            status: "fail",
            score: 4.5,
            failureMode: "Incomplete Information",
            reason: "Did not provide details about what the premium feature costs monthly, or offer to review the activation logs to verify.",
            recommendedAction: "Include pricing information when discussing paid features. Offer to verify activation details when customer expresses confusion.",
          },
        },
      },
      {
        id: "turn_4",
        user: { content: "Yes please deactivate it. And can I get a refund?" },
        assistant: {
          content: "I've deactivated the premium feature effective immediately. Regarding a refund, since you used the service for most of December, I can offer a 50% partial refund of $15. Would you like me to process that?",
          model: "Claude",
          latency: "2.5s",
          evaluation: {
            status: "pass",
            score: 8.0,
            failureMode: null,
            reason: "Took action as requested, provided reasonable refund offer with explanation.",
            recommendedAction: null,
          },
        },
      },
      {
        id: "turn_5",
        user: { content: "That's not fair, I didn't even know I had it. I want a full refund." },
        assistant: {
          content: "I understand your frustration. Let me escalate this to our billing department for a full refund review. You should receive an email within 24-48 hours with their decision. Is there anything else I can help you with today?",
          model: "GPT-4",
          latency: "1.9s",
          evaluation: {
            status: "pass",
            score: 9.0,
            failureMode: null,
            reason: "Good escalation handling, set clear expectations, empathetic response.",
            recommendedAction: null,
          },
        },
      },
      {
        id: "turn_6",
        user: { content: "How do I check my usage history?" },
        assistant: {
          content: "You can view your usage history in the app under Settings > Account > Usage History.",
          model: "GPT-4",
          latency: "0.8s",
          evaluation: {
            status: "fail",
            score: 5.0,
            failureMode: "Hallucination",
            reason: "The navigation path provided is incorrect. The actual path is Profile > Billing > View History.",
            recommendedAction: "Verify navigation paths against current UI documentation before providing instructions.",
          },
        },
      },
      {
        id: "turn_7",
        user: { content: "Thanks for your help." },
        assistant: {
          content: "You're welcome! If you have any other questions, feel free to reach out. Have a great day!",
          model: "GPT-4",
          latency: "0.6s",
          evaluation: {
            status: "pass",
            score: 9.5,
            failureMode: null,
            reason: "Polite closing, invites future contact.",
            recommendedAction: null,
          },
        },
      },
    ],
  },
  session_002: {
    id: "session_002",
    userId: "user_002",
    startTime: "2024-01-15T13:15:00Z",
    objective: "Product recommendation",
    models: ["GPT-4"],
    overallStatus: "pass",
    avgScore: 9.2,
    turns: [
      {
        id: "turn_1",
        user: { content: "I'm looking for a laptop for video editing under $1500." },
        assistant: {
          content: "Great choice! For video editing under $1500, I'd recommend the ASUS ProArt StudioBook or the MacBook Air M2. Both offer excellent performance for video editing with good displays. The ASUS has a larger 15.6\" 4K OLED screen, while the MacBook offers better battery life. Would you like more details on either?",
          model: "GPT-4",
          latency: "1.8s",
          evaluation: {
            status: "pass",
            score: 9.5,
            failureMode: null,
            reason: "Relevant recommendations within budget, highlighted key differentiators, invited follow-up.",
            recommendedAction: null,
          },
        },
      },
      {
        id: "turn_2",
        user: { content: "Tell me more about the ASUS one." },
        assistant: {
          content: "The ASUS ProArt StudioBook features:\n• Intel Core i7-12700H processor\n• 16GB DDR5 RAM (upgradeable to 32GB)\n• 512GB NVMe SSD\n• NVIDIA RTX 3050 Ti graphics\n• 15.6\" 4K OLED display with 100% DCI-P3 coverage\n• Thunderbolt 4 ports for fast external storage\n\nIt's priced at $1,399 and includes a 1-year warranty. Would you like me to check availability?",
          model: "GPT-4",
          latency: "2.0s",
          evaluation: {
            status: "pass",
            score: 9.0,
            failureMode: null,
            reason: "Comprehensive specs, clear formatting, included price and warranty info.",
            recommendedAction: null,
          },
        },
      },
    ],
  },
  session_003: {
    id: "session_003",
    userId: "user_003",
    startTime: "2024-01-15T11:45:00Z",
    objective: "Technical troubleshooting",
    models: ["Claude", "GPT-4"],
    overallStatus: "fail",
    avgScore: 5.4,
    turns: [
      {
        id: "turn_1",
        user: { content: "My application keeps crashing when I try to export files." },
        assistant: {
          content: "I'm sorry to hear that. To help troubleshoot, could you tell me:\n1. Which application are you using?\n2. What file format are you trying to export?\n3. Does this happen with all files or specific ones?",
          model: "Claude",
          latency: "1.5s",
          evaluation: {
            status: "pass",
            score: 8.5,
            failureMode: null,
            reason: "Good diagnostic questions, structured format.",
            recommendedAction: null,
          },
        },
      },
      {
        id: "turn_2",
        user: { content: "It's your video editor app, exporting to MP4, happens with all files." },
        assistant: {
          content: "Try reinstalling the application. That should fix it.",
          model: "Claude",
          latency: "0.9s",
          evaluation: {
            status: "fail",
            score: 3.0,
            failureMode: "Insufficient Response",
            reason: "Jumped to drastic solution without trying simpler fixes first (clear cache, update app, check disk space).",
            recommendedAction: "Follow troubleshooting escalation: check basics first (updates, cache, storage), then medium fixes, then reinstall as last resort.",
          },
        },
      },
      {
        id: "turn_3",
        user: { content: "I already tried that and it didn't work." },
        assistant: {
          content: "In that case, there might be a compatibility issue with your system. What operating system are you using?",
          model: "GPT-4",
          latency: "1.2s",
          evaluation: {
            status: "pass",
            score: 7.0,
            failureMode: null,
            reason: "Continued troubleshooting appropriately after first solution failed.",
            recommendedAction: null,
          },
        },
      },
      {
        id: "turn_4",
        user: { content: "Windows 11, latest version." },
        assistant: {
          content: "Windows 11 is fully supported. The issue might be with your graphics drivers. Please update them from the NVIDIA website.",
          model: "GPT-4",
          latency: "1.4s",
          evaluation: {
            status: "fail",
            score: 4.0,
            failureMode: "Assumption Without Verification",
            reason: "Assumed user has NVIDIA graphics without asking. User might have AMD or Intel graphics.",
            recommendedAction: "Ask about hardware specifications before providing hardware-specific advice.",
          },
        },
      },
    ],
  },
};

export const useConversationDetail = (sessionId) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sessionId) {
      setDetail(null);
      setLoading(false);
      return;
    }

    const abortController = new AbortController();

    const fetchDetail = async () => {
      try {
        setLoading(true);
        const data = await api.getConversationDetail(sessionId, { signal: abortController.signal });
        
        if (!abortController.signal.aborted) {
          setDetail(data);
          setError(null);
        }
      } catch (err) {
        if (abortController.signal.aborted) return;
        
        console.error("Failed to fetch session detail:", err);
        // Use mock data as fallback
        const mockData = mockSessionDetails[sessionId] || mockSessionDetails.session_001;
        setDetail(mockData);
        setError(null);
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchDetail();

    return () => {
      abortController.abort();
    };
  }, [sessionId]);

  return { detail, loading, error };
};
