from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

app = FastAPI(title="AI Agent Monitor API", version="1.0.0", root_path="/api/v1")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mock Data - User Sessions with Conversation Turns
MOCK_SESSIONS = [
    {
        "id": "session_001",
        "userId": "user_001",
        "startTime": "2024-01-15T14:30:00Z",
        "endTime": "2024-01-15T14:45:00Z",
        "totalTurns": 7,
        "passCount": 5,
        "failCount": 2,
        "overallStatus": "review",
        "objective": "Get help with billing inquiry",
        "models": ["GPT-4", "Claude"],
        "avgScore": 7.8,
        "latency": "2.1s",
        "cost": "$0.08",
    },
    {
        "id": "session_002",
        "userId": "user_002",
        "startTime": "2024-01-15T13:15:00Z",
        "endTime": "2024-01-15T13:25:00Z",
        "totalTurns": 5,
        "passCount": 5,
        "failCount": 0,
        "overallStatus": "pass",
        "objective": "Product recommendation",
        "models": ["GPT-4"],
        "avgScore": 9.2,
        "latency": "1.8s",
        "cost": "$0.04",
    },
    {
        "id": "session_003",
        "userId": "user_003",
        "startTime": "2024-01-15T11:45:00Z",
        "endTime": "2024-01-15T12:00:00Z",
        "totalTurns": 4,
        "passCount": 2,
        "failCount": 2,
        "overallStatus": "fail",
        "objective": "Technical troubleshooting",
        "models": ["Claude", "GPT-4"],
        "avgScore": 5.4,
        "latency": "3.2s",
        "cost": "$0.15",
    },
    {
        "id": "session_004",
        "userId": "user_004",
        "startTime": "2024-01-14T16:20:00Z",
        "endTime": "2024-01-14T16:35:00Z",
        "totalTurns": 6,
        "passCount": 6,
        "failCount": 0,
        "overallStatus": "pass",
        "objective": "Account settings help",
        "models": ["GPT-4"],
        "avgScore": 8.9,
        "latency": "1.5s",
        "cost": "$0.03",
    },
    {
        "id": "session_005",
        "userId": "user_005",
        "startTime": "2024-01-14T10:00:00Z",
        "endTime": "2024-01-14T10:30:00Z",
        "totalTurns": 15,
        "passCount": 12,
        "failCount": 3,
        "overallStatus": "review",
        "objective": "Complex order modification",
        "models": ["GPT-4", "Claude"],
        "avgScore": 7.2,
        "latency": "2.8s",
        "cost": "$0.22",
    },
]

# Detailed session data with conversation turns
MOCK_SESSION_DETAILS = {
    "session_001": {
        "id": "session_001",
        "userId": "user_001",
        "startTime": "2024-01-15T14:30:00Z",
        "endTime": "2024-01-15T14:45:00Z",
        "objective": "Get help with billing inquiry",
        "models": ["GPT-4", "Claude"],
        "overallStatus": "review",
        "avgScore": 7.8,
        "turns": [
            {
                "id": "turn_1",
                "user": {"content": "Hi, I have a question about my recent bill. It seems higher than usual."},
                "assistant": {
                    "content": "Hello! I'd be happy to help you review your bill. Could you please provide your account number or the billing period you're concerned about?",
                    "model": "GPT-4",
                    "latency": "1.2s",
                    "evaluation": {
                        "status": "pass",
                        "score": 9.0,
                        "failureMode": None,
                        "reason": "Appropriate greeting, clear request for needed information, professional tone.",
                        "recommendedAction": None,
                    },
                },
            },
            {
                "id": "turn_2",
                "user": {"content": "My account is 12345. The bill is for December 2024."},
                "assistant": {
                    "content": "Thank you! I can see your December bill is $150.00, which is $30 higher than November. This increase is due to the premium feature you activated on December 5th.",
                    "model": "GPT-4",
                    "latency": "2.1s",
                    "evaluation": {
                        "status": "pass",
                        "score": 8.5,
                        "failureMode": None,
                        "reason": "Accurate information retrieval, clear explanation of the difference.",
                        "recommendedAction": None,
                    },
                },
            },
            {
                "id": "turn_3",
                "user": {"content": "I don't remember activating any premium feature. Can you tell me more?"},
                "assistant": {
                    "content": "The premium feature was activated from your mobile app. It includes advanced analytics and priority support. Would you like me to deactivate it?",
                    "model": "Claude",
                    "latency": "1.8s",
                    "evaluation": {
                        "status": "fail",
                        "score": 4.5,
                        "failureMode": "Incomplete Information",
                        "reason": "Did not provide details about what the premium feature costs monthly, or offer to review the activation logs to verify.",
                        "recommendedAction": "Include pricing information when discussing paid features. Offer to verify activation details when customer expresses confusion.",
                    },
                },
            },
            {
                "id": "turn_4",
                "user": {"content": "Yes please deactivate it. And can I get a refund?"},
                "assistant": {
                    "content": "I've deactivated the premium feature effective immediately. Regarding a refund, since you used the service for most of December, I can offer a 50% partial refund of $15. Would you like me to process that?",
                    "model": "Claude",
                    "latency": "2.5s",
                    "evaluation": {
                        "status": "pass",
                        "score": 8.0,
                        "failureMode": None,
                        "reason": "Took action as requested, provided reasonable refund offer with explanation.",
                        "recommendedAction": None,
                    },
                },
            },
            {
                "id": "turn_5",
                "user": {"content": "That's not fair, I didn't even know I had it. I want a full refund."},
                "assistant": {
                    "content": "I understand your frustration. Let me escalate this to our billing department for a full refund review. You should receive an email within 24-48 hours with their decision. Is there anything else I can help you with today?",
                    "model": "GPT-4",
                    "latency": "1.9s",
                    "evaluation": {
                        "status": "pass",
                        "score": 9.0,
                        "failureMode": None,
                        "reason": "Good escalation handling, set clear expectations, empathetic response.",
                        "recommendedAction": None,
                    },
                },
            },
            {
                "id": "turn_6",
                "user": {"content": "How do I check my usage history?"},
                "assistant": {
                    "content": "You can view your usage history in the app under Settings > Account > Usage History.",
                    "model": "GPT-4",
                    "latency": "0.8s",
                    "evaluation": {
                        "status": "fail",
                        "score": 5.0,
                        "failureMode": "Hallucination",
                        "reason": "The navigation path provided is incorrect. The actual path is Profile > Billing > View History.",
                        "recommendedAction": "Verify navigation paths against current UI documentation before providing instructions.",
                    },
                },
            },
            {
                "id": "turn_7",
                "user": {"content": "Thanks for your help."},
                "assistant": {
                    "content": "You're welcome! If you have any other questions, feel free to reach out. Have a great day!",
                    "model": "GPT-4",
                    "latency": "0.6s",
                    "evaluation": {
                        "status": "pass",
                        "score": 9.5,
                        "failureMode": None,
                        "reason": "Polite closing, invites future contact.",
                        "recommendedAction": None,
                    },
                },
            },
        ],
    },
    "session_002": {
        "id": "session_002",
        "userId": "user_002",
        "startTime": "2024-01-15T13:15:00Z",
        "objective": "Product recommendation",
        "models": ["GPT-4"],
        "overallStatus": "pass",
        "avgScore": 9.2,
        "turns": [
            {
                "id": "turn_1",
                "user": {"content": "I'm looking for a laptop for video editing under $1500."},
                "assistant": {
                    "content": "Great choice! For video editing under $1500, I'd recommend the ASUS ProArt StudioBook or the MacBook Air M2. Both offer excellent performance for video editing with good displays. The ASUS has a larger 15.6\" 4K OLED screen, while the MacBook offers better battery life. Would you like more details on either?",
                    "model": "GPT-4",
                    "latency": "1.8s",
                    "evaluation": {
                        "status": "pass",
                        "score": 9.5,
                        "failureMode": None,
                        "reason": "Relevant recommendations within budget, highlighted key differentiators, invited follow-up.",
                        "recommendedAction": None,
                    },
                },
            },
            {
                "id": "turn_2",
                "user": {"content": "Tell me more about the ASUS one."},
                "assistant": {
                    "content": "The ASUS ProArt StudioBook features:\n• Intel Core i7-12700H processor\n• 16GB DDR5 RAM (upgradeable to 32GB)\n• 512GB NVMe SSD\n• NVIDIA RTX 3050 Ti graphics\n• 15.6\" 4K OLED display with 100% DCI-P3 coverage\n• Thunderbolt 4 ports for fast external storage\n\nIt's priced at $1,399 and includes a 1-year warranty. Would you like me to check availability?",
                    "model": "GPT-4",
                    "latency": "2.0s",
                    "evaluation": {
                        "status": "pass",
                        "score": 9.0,
                        "failureMode": None,
                        "reason": "Comprehensive specs, clear formatting, included price and warranty info.",
                        "recommendedAction": None,
                    },
                },
            },
            {
                "id": "turn_3",
                "user": {"content": "Yes, please check if it's available."},
                "assistant": {
                    "content": "I checked our inventory and the ASUS ProArt StudioBook is available for immediate shipping. We also have a current promotion - free 2-day shipping if you order today. Would you like me to add it to your cart?",
                    "model": "GPT-4",
                    "latency": "1.5s",
                    "evaluation": {
                        "status": "pass",
                        "score": 9.2,
                        "failureMode": None,
                        "reason": "Confirmed availability, mentioned promotion, clear call to action.",
                        "recommendedAction": None,
                    },
                },
            },
            {
                "id": "turn_4",
                "user": {"content": "Does it come with any software included?"},
                "assistant": {
                    "content": "Yes! The ASUS ProArt StudioBook comes with:\n• Windows 11 Pro pre-installed\n• 3-month Adobe Creative Cloud trial (includes Premiere Pro, After Effects)\n• ASUS ProArt Creator Hub for color calibration\n• McAfee LiveSafe 1-year subscription\n\nFor video editing, the Adobe trial is particularly valuable as Premiere Pro alone costs $22.99/month.",
                    "model": "GPT-4",
                    "latency": "1.7s",
                    "evaluation": {
                        "status": "pass",
                        "score": 9.3,
                        "failureMode": None,
                        "reason": "Complete software bundle information, added value context for the Adobe trial.",
                        "recommendedAction": None,
                    },
                },
            },
            {
                "id": "turn_5",
                "user": {"content": "Perfect, I'll take it. Add to cart please."},
                "assistant": {
                    "content": "Excellent choice! I've added the ASUS ProArt StudioBook ($1,399) to your cart. With free 2-day shipping, your estimated delivery is January 17th. You can proceed to checkout whenever you're ready. Is there anything else you'd like to add?",
                    "model": "GPT-4",
                    "latency": "1.2s",
                    "evaluation": {
                        "status": "pass",
                        "score": 9.0,
                        "failureMode": None,
                        "reason": "Confirmed action, provided delivery estimate, offered additional assistance.",
                        "recommendedAction": None,
                    },
                },
            },
        ],
    },
    "session_003": {
        "id": "session_003",
        "userId": "user_003",
        "startTime": "2024-01-15T11:45:00Z",
        "objective": "Technical troubleshooting",
        "models": ["Claude", "GPT-4"],
        "overallStatus": "fail",
        "avgScore": 5.4,
        "turns": [
            {
                "id": "turn_1",
                "user": {"content": "My application keeps crashing when I try to export files."},
                "assistant": {
                    "content": "I'm sorry to hear that. To help troubleshoot, could you tell me:\n1. Which application are you using?\n2. What file format are you trying to export?\n3. Does this happen with all files or specific ones?",
                    "model": "Claude",
                    "latency": "1.5s",
                    "evaluation": {
                        "status": "pass",
                        "score": 8.5,
                        "failureMode": None,
                        "reason": "Good diagnostic questions, structured format.",
                        "recommendedAction": None,
                    },
                },
            },
            {
                "id": "turn_2",
                "user": {"content": "It's your video editor app, exporting to MP4, happens with all files."},
                "assistant": {
                    "content": "Try reinstalling the application. That should fix it.",
                    "model": "Claude",
                    "latency": "0.9s",
                    "evaluation": {
                        "status": "fail",
                        "score": 3.0,
                        "failureMode": "Insufficient Response",
                        "reason": "Jumped to drastic solution without trying simpler fixes first (clear cache, update app, check disk space).",
                        "recommendedAction": "Follow troubleshooting escalation: check basics first (updates, cache, storage), then medium fixes, then reinstall as last resort.",
                    },
                },
            },
            {
                "id": "turn_3",
                "user": {"content": "I already tried that and it didn't work."},
                "assistant": {
                    "content": "In that case, there might be a compatibility issue with your system. What operating system are you using?",
                    "model": "GPT-4",
                    "latency": "1.2s",
                    "evaluation": {
                        "status": "pass",
                        "score": 7.0,
                        "failureMode": None,
                        "reason": "Continued troubleshooting appropriately after first solution failed.",
                        "recommendedAction": None,
                    },
                },
            },
            {
                "id": "turn_4",
                "user": {"content": "Windows 11, latest version."},
                "assistant": {
                    "content": "Windows 11 is fully supported. The issue might be with your graphics drivers. Please update them from the NVIDIA website.",
                    "model": "GPT-4",
                    "latency": "1.4s",
                    "evaluation": {
                        "status": "fail",
                        "score": 4.0,
                        "failureMode": "Assumption Without Verification",
                        "reason": "Assumed user has NVIDIA graphics without asking. User might have AMD or Intel graphics.",
                        "recommendedAction": "Ask about hardware specifications before providing hardware-specific advice.",
                    },
                },
            },
        ],
    },
    "session_004": {
        "id": "session_004",
        "userId": "user_004",
        "startTime": "2024-01-14T16:20:00Z",
        "objective": "Account settings help",
        "models": ["GPT-4"],
        "overallStatus": "pass",
        "avgScore": 8.9,
        "turns": [
            {
                "id": "turn_1",
                "user": {"content": "How do I change my email address on my account?"},
                "assistant": {
                    "content": "To change your email address:\n1. Go to Settings > Account > Personal Information\n2. Click 'Edit' next to your email address\n3. Enter your new email and click 'Save'\n4. You'll receive a verification email at your new address\n5. Click the verification link to confirm the change\n\nWould you like me to guide you through this step by step?",
                    "model": "GPT-4",
                    "latency": "1.3s",
                    "evaluation": {
                        "status": "pass",
                        "score": 9.2,
                        "failureMode": None,
                        "reason": "Clear step-by-step instructions, offered additional help.",
                        "recommendedAction": None,
                    },
                },
            },
            {
                "id": "turn_2",
                "user": {"content": "What if I don't receive the verification email?"},
                "assistant": {
                    "content": "If you don't receive the verification email within 5 minutes:\n1. Check your spam/junk folder\n2. Add noreply@ourservice.com to your contacts\n3. Click 'Resend verification email' in your account settings\n\nIf it still doesn't arrive, we can verify your identity manually. Just let me know!",
                    "model": "GPT-4",
                    "latency": "1.4s",
                    "evaluation": {
                        "status": "pass",
                        "score": 8.8,
                        "failureMode": None,
                        "reason": "Anticipated common issues, provided fallback options.",
                        "recommendedAction": None,
                    },
                },
            },
        ],
    },
    "session_005": {
        "id": "session_005",
        "userId": "user_005",
        "startTime": "2024-01-14T10:00:00Z",
        "objective": "Complex order modification",
        "models": ["GPT-4", "Claude"],
        "overallStatus": "review",
        "avgScore": 7.2,
        "turns": [
            {
                "id": "turn_1",
                "user": {"content": "I need to change my order. I ordered the wrong size."},
                "assistant": {
                    "content": "I'd be happy to help you modify your order. Could you please provide your order number so I can look it up?",
                    "model": "GPT-4",
                    "latency": "1.0s",
                    "evaluation": {
                        "status": "pass",
                        "score": 8.5,
                        "failureMode": None,
                        "reason": "Appropriate request for order information.",
                        "recommendedAction": None,
                    },
                },
            },
            {
                "id": "turn_2",
                "user": {"content": "Order #ORD-2024-5678"},
                "assistant": {
                    "content": "I found your order. You ordered a Medium Blue T-shirt. The order is currently being prepared for shipping. What size would you like to change it to?",
                    "model": "GPT-4",
                    "latency": "1.8s",
                    "evaluation": {
                        "status": "pass",
                        "score": 8.0,
                        "failureMode": None,
                        "reason": "Confirmed order details, asked for needed information.",
                        "recommendedAction": None,
                    },
                },
            },
            {
                "id": "turn_3",
                "user": {"content": "I need a Large instead."},
                "assistant": {
                    "content": "I've updated your order to Large. The change has been processed successfully.",
                    "model": "Claude",
                    "latency": "2.2s",
                    "evaluation": {
                        "status": "fail",
                        "score": 5.0,
                        "failureMode": "Missing Confirmation Details",
                        "reason": "Did not confirm if the Large size is available or if this affects delivery date.",
                        "recommendedAction": "Always confirm availability and any impact on delivery when modifying orders.",
                    },
                },
            },
        ],
    },
}

MOCK_METRICS = {
    "totalConversations": 1250,
    "passRate": 88,
    "avgScore": 8.4,
    "avgLatency": 2.3,
    "trends": {
        "conversations": {"value": 5, "direction": "up"},
        "passRate": {"value": 2, "direction": "up"},
        "score": {"value": 3, "direction": "up"},
        "latency": {"value": -5, "direction": "down"},
    },
}

MOCK_FAILURE_MODES = [
    {"id": 1, "name": "Hallucination", "count": 45, "percentage": 35},
    {"id": 2, "name": "Incomplete Information", "count": 32, "percentage": 25},
    {"id": 3, "name": "Assumption Without Verification", "count": 28, "percentage": 22},
    {"id": 4, "name": "Insufficient Response", "count": 15, "percentage": 12},
    {"id": 5, "name": "Missing Confirmation Details", "count": 8, "percentage": 6},
]

# ============ ROUTES ============

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }



@app.get("/metrics")
async def get_metrics(timeRange: str = "7d"):
    """
    Get dashboard metrics
    
    TODO: Replace with real database query
    """
    return MOCK_METRICS


@app.get("/conversations")
async def get_conversations(
    status: Optional[str] = None, 
    model: Optional[str] = None, 
    range: str = "7d",
    skip: int = 0, 
    limit: int = 100
):
    """
    Get list of user sessions with filtering support
    """
    filtered_sessions = MOCK_SESSIONS
    
    if status:
        filtered_sessions = [s for s in filtered_sessions if s["overallStatus"] == status]
        
    if model:
        filtered_sessions = [s for s in filtered_sessions if model in s["models"]]
        
    # Range is mocked for now as data is static
    if range == "24h":
        filtered_sessions = filtered_sessions[:2]

    return filtered_sessions[skip : skip + limit]


@app.get("/conversations/{session_id}")
async def get_conversation_detail(session_id: str):
    """
    Get specific session details with all conversation turns
    
    TODO: Replace with:
    - SELECT * FROM sessions WHERE id = session_id
    - JOIN with turns, evaluations, etc.
    """
    session = MOCK_SESSION_DETAILS.get(session_id)
    if not session:
        # Return the first session as fallback for demo
        return MOCK_SESSION_DETAILS.get("session_001")
    return session


@app.get("/evaluations")
async def get_evaluations():
    """
    Get evaluation metrics
    
    TODO: Replace with real evaluation data
    """
    return {
        "evaluations": [
            {"id": 1, "name": "Accuracy", "score": 92, "trend": "+3%", "status": "good"},
            {"id": 2, "name": "Helpfulness", "score": 88, "trend": "+5%", "status": "good"},
            {"id": 3, "name": "Safety", "score": 97, "trend": "+1%", "status": "excellent"},
            {"id": 4, "name": "Relevance", "score": 85, "trend": "-2%", "status": "warning"},
            {"id": 5, "name": "Coherence", "score": 91, "trend": "+4%", "status": "good"},
            {"id": 6, "name": "Completeness", "score": 78, "trend": "+8%", "status": "warning"}
        ]
    }


@app.get("/failure-modes")
async def get_failure_modes(timeRange: str = "7d"):
    """
    Get failure modes analysis
    
    TODO: Replace with:
    - SELECT failure_type, COUNT(*) FROM failures GROUP BY failure_type
    - Filter by timeRange
    """
    return MOCK_FAILURE_MODES


@app.get("/failure-modes/trends")
async def get_failure_trends(timeRange: str = "30d"):
    """
    Get failure trends over time
    
    TODO: Replace with:
    - SELECT date, COUNT(*) FROM failures GROUP BY date ORDER BY date
    """
    return [
        {"date": "2024-01-10", "count": 120},
        {"date": "2024-01-11", "count": 110},
        {"date": "2024-01-12", "count": 105},
        {"date": "2024-01-13", "count": 98},
        {"date": "2024-01-14", "count": 95},
        {"date": "2024-01-15", "count": 87},
    ]


@app.get("/models")
async def get_models():
    """
    Get available AI models
    
    TODO: Replace with real model registry
    """
    return [
        {
            "id": 1,
            "name": "GPT-4 Turbo",
            "version": "gpt-4-turbo-preview",
            "status": "active",
            "accuracy": 94,
            "latency": "1.2s",
            "cost": "$0.03/1k",
            "requests": "125K",
            "lastUsed": "2 min ago"
        },
        {
            "id": 2,
            "name": "Claude 3 Opus",
            "version": "claude-3-opus-20240229",
            "status": "active",
            "accuracy": 96,
            "latency": "1.8s",
            "cost": "$0.015/1k",
            "requests": "89K",
            "lastUsed": "5 min ago"
        },
        {
            "id": 3,
            "name": "GPT-3.5 Turbo",
            "version": "gpt-3.5-turbo",
            "status": "fallback",
            "accuracy": 87,
            "latency": "0.4s",
            "cost": "$0.002/1k",
            "requests": "45K",
            "lastUsed": "1 hour ago"
        },
        {
            "id": 4,
            "name": "Gemini Pro",
            "version": "gemini-1.5-pro",
            "status": "testing",
            "accuracy": 91,
            "latency": "1.1s",
            "cost": "$0.007/1k",
            "requests": "12K",
            "lastUsed": "3 hours ago"
        }
    ]


@app.get("/actions")
async def get_actions():
    """
    Get recommended actions
    
    TODO: Replace with:
    - SELECT * FROM recommended_actions
    - Filter by status, priority
    """
    return [
        {
            "id": 1,
            "title": "Improve response accuracy for billing queries",
            "description": "15% of billing-related conversations show confusion. Add clarifying prompts.",
            "priority": "high",
            "impact": "High",
            "status": "pending",
            "category": "Accuracy"
        },
        {
            "id": 2,
            "title": "Reduce response latency for complex queries",
            "description": "Average response time exceeds 3s for multi-step questions.",
            "priority": "medium",
            "impact": "Medium",
            "status": "in-progress",
            "category": "Performance"
        },
        {
            "id": 3,
            "title": "Update knowledge base with Q4 policy changes",
            "description": "New refund policies not reflected in current responses.",
            "priority": "high",
            "impact": "High",
            "status": "pending",
            "category": "Knowledge"
        },
        {
            "id": 4,
            "title": "Add escalation path for sensitive topics",
            "description": "Implement human handoff for legal and compliance queries.",
            "priority": "low",
            "impact": "Low",
            "status": "completed",
            "category": "Safety"
        }
    ]


@app.patch("/actions/{action_id}")
async def update_action(action_id: int, status: str):
    """
    Update action status
    
    TODO: Replace with:
    - UPDATE recommended_actions SET status = ? WHERE id = ?
    """
    return {"success": True, "id": action_id, "status": status}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=3000)
