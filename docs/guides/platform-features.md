---
sidebar_position: 3
---

# Platform Features

## Setup Wizard

First-time setup guides you through:

1. **Account Creation**: Create your admin account (email, name, password)
2. **LLM Connection**: Configure your OpenAI, Anthropic, or other API keys
3. **Evaluator Setup**: Choose between LLM-as-a-judge or human annotation
4. **Custom Prompts**: Customize evaluation criteria and prompts
5. **Schema Configuration**: Define custom evaluation schemas

## Evaluation

### LLM-as-a-Judge

- Automatic evaluation of traces using configurable LLM evaluators
- Granular span-level evaluation + overall trace evaluation
- Custom output schemas with flexible validation
- Support for multiple providers (OpenAI, Anthropic, Google)
- Batch evaluation with filtering

### Human Annotation

- Create annotation queues with custom score configurations
- Support for categorical, numerical, and binary scores
- FIFO processing with concurrency safety
- Export annotations for fine-tuning (JSONL, CSV, Parquet)
- Publish completed queues as versioned datasets

## Analytics & Insights

### Dashboard

- Real-time KPIs: total traces, pass rate, avg score, cost
- Breakdown views: traces by name, model costs, score evaluations
- Time-series trends with configurable time ranges
- Model comparison and performance metrics

### Advanced Analytics

- Score distribution analysis
- Failure mode detection and trending
- Correlation analysis between metrics
- Cost forecasting based on historical data
- Anomaly detection using statistical methods
- Tool/function call analytics

### Failure Analysis

- Automatic failure mode categorization
- Time-series trending of failures
- Failure breakdown by model
- Actionable insights and recommendations

## Data Management

### Conversations

- Group traces by conversation/session
- Multi-turn conversation tracking
- Conversation-level analytics

### Datasets

- Create datasets from annotation queues
- Manual dataset creation and management
- Version control for datasets
- Export in multiple formats (JSONL, CSV, Parquet)
- Link items back to source traces/spans

### Actions

- Auto-generated improvement recommendations
- Status tracking (open, in_progress, completed, dismissed)
- Manual resolution workflows

## Database Models

### Core Models

- **User**: Authenticated user accounts
- **APIKey**: SDK authentication keys (prefixed with `audi_`)
- **Conversation**: Multi-turn conversation sessions
- **Trace**: Individual agent interactions
- **Span**: Internal operations (LLM calls, tools, etc.)
- **Evaluator**: Custom evaluator configurations
- **LLMConnection**: API connection settings
- **ModelPricing**: Per-model pricing for cost calculation (seeded with defaults on first run)

### Annotation Models

- **ScoreConfig**: Score configuration definitions
- **AnnotationQueue**: Annotation queue management
- **AnnotationQueueItem**: Items in queues
- **Annotation**: Human-provided scores

### Dataset Models

- **Dataset**: Named dataset collections
- **DatasetItem**: Individual dataset entries
