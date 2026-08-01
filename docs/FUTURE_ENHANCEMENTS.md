# Future Enhancements

## Communication

- **Twilio provider** — Complete `TwilioVoiceProvider` with official SDK
- **WhatsApp channel** — Extend orchestrator for Dial WhatsApp messages
- **Email provider** — SendGrid/Resend for email fallback chain
- **Inbound call routing** — Route inbound Dial calls to assigned agents
- **Real-time transcription UI** — Stream transcripts via WebSocket to dashboard

## Orchestration

- **Workflow builder** — Visual editor for multi-step communication cadences
- **A/B testing** — Test outbound instructions and measure conversion
- **Smart send-time** — ML-based optimal call timing per lead timezone
- **DNC / compliance** — Do-not-call list and consent tracking

## Lead Intelligence

- **ML scoring model** — Replace heuristic scorer with trained model
- **Property matching** — Auto-match leads to listings
- **Sentiment analysis** — Analyze call transcripts for intent signals

## Platform

- **Full svc-orchestrator** — Pipeline state machine across all services
- **RabbitMQ event bus** — Wire qualification → engagement via events
- **OpenTelemetry** — Distributed tracing across microservices
- **Multi-tenant** — Agency-level isolation for brokerage networks
- **Mobile app** — Agent mobile client for call notifications

## Infrastructure

- **Kubernetes deployment** — Production manifests for all services
- **CI/CD pipeline** — GitHub Actions for test, build, deploy
- **Rate limiting per tenant** — Usage-based API quotas
