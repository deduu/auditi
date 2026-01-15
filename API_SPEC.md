# AI Monitor Dashboard - API Specification

To use this dashboard with your own AI Agent system, implement a REST API that serves the following endpoints. The dashboard expects JSON responses in the exact format described below.

## Base URL
The dashboard can be configured to point to any Base URL (e.g., `http://localhost:3000/api/v1`).

---

## 1. Dashboard Metrics
**Endpoint**: `GET /metrics`
**Query Params**: `timeRange` (e.g., "7d", "30d")

### Response Schema
```json
{
  "totalConversations": 1250,
  "passRate": 88,
  "avgScore": 8.4,
  "avgLatency": 2.3,
  "trends": {
    "conversations": { "value": 5, "direction": "up" },
    "passRate": { "value": 2, "direction": "up" },
    "score": { "value": 3, "direction": "up" },
    "latency": { "value": -5, "direction": "down" }
  }
}
```

---

## 2. Conversations
**Endpoint**: `GET /conversations`
**Query Params**: `limit` (int), `skip` (int), `status` (string)

### Response Schema
Array of session objects:
```json
[
  {
    "id": "unique-session-id",
    "userId": "user-123",
    "startTime": "2024-01-15T14:30:00Z",
    "totalTurns": 7,
    "passCount": 5,
    "failCount": 2,
    "overallStatus": "review", // "pass" | "fail" | "review"
    "objective": "User intent summary",
    "models": ["GPT-4"],
    "avgScore": 7.8,
    "latency": "2.1s",
    "cost": "$0.08"
  }
]
```

---

## 3. Conversation Details
**Endpoint**: `GET /conversations/{id}`

### Response Schema
Detailed session object including `turns`:
```json
{
  "id": "session-123",
  // ... (same fields as above)
  "turns": [
    {
      "id": "turn-1",
      "user": { "content": "User input text" },
      "assistant": {
        "content": "Agent response text",
        "model": "GPT-4",
        "latency": "1.2s",
        "evaluation": {
          "status": "pass", // "pass" | "fail"
          "score": 9.0,
          "failureMode": null, // or string e.g. "Hallucination"
          "reason": "Explanation of the score",
          "recommendedAction": "Suggestion for improvement"
        }
      }
    }
  ]
}
```

---

## 4. Evaluations & Failure Modes
**Endpoint**: `GET /evaluations`
### Response Schema
```json
{
  "evaluations": [
    { 
      "id": 1, 
      "name": "Accuracy", 
      "score": 92, 
      "trend": "+3%", 
      "status": "good" // "good" | "warning" | "excellent" | "poor"
    }
  ]
}
```

**Endpoint**: `GET /failure-modes`
### Response Schema
```json
[
  { "id": 1, "name": "Hallucination", "count": 45, "percentage": 35 },
  { "id": 2, "name": "Timeout", "count": 10, "percentage": 10 }
]
```

---

## 5. Models
**Endpoint**: `GET /models`

### Response Schema
```json
[
  {
    "id": 1,
    "name": "GPT-4 Turbo",
    "version": "gpt-4-turbo-preview",
    "status": "active", // "active" | "testing" | "fallback"
    "accuracy": 94,
    "latency": "1.2s",
    "cost": "$0.03/1k",
    "requests": "125K",
    "lastUsed": "2 min ago"
  }
]
```

---

## 6. Recommended Actions
**Endpoint**: `GET /actions`

### Response Schema
```json
[
  {
    "id": 1,
    "title": "Clarify Billing Prompt",
    "description": "High failure rate in billing queries",
    "priority": "high", // "high" | "medium" | "low"
    "impact": "High",
    "status": "pending", // "pending" | "in-progress" | "completed"
    "category": "Accuracy"
  }
]
```
