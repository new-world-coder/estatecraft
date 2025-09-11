# EstateCraft 🏗️

**EstateCraft - AI-Powered Real Estate Sales Platform** - Increase lead-to-close conversion by 37% and reduce manual overhead by 60%.

## 🎯 Project Overview

EstateCraft is a comprehensive, event-driven microservices architecture designed to revolutionize real estate sales operations through AI-powered lead qualification, automated engagement, and intelligent follow-up systems.

## 🏗️ Architecture

- **Monorepo**: TypeScript with npm/pnpm workspaces
- **Containerization**: Docker for local dev & production parity
- **Messaging**: RabbitMQ for event-driven communication
- **Caching**: Redis for performance optimization
- **Observability**: OpenTelemetry for distributed tracing
- **Core DB**: Postgres with Prisma ORM

## 🚀 Services

| Service | Description | Port |
|---------|-------------|------|
| `webapp-dashboard` | Frontend dashboard | 3002 |
| `svc-api` | API gateway (REST & WebSocket) | 3000 |
| `svc-auth` | Authentication & RBAC | 3001 |
| `svc-orchestrator` | Pipeline state machine | - |
| `svc-qualifier` | Lead qualification engine | - |
| `svc-engagement` | Message template & delivery | - |
| `svc-followup` | Cadence & follow-up engine | - |
| `svc-closer` | Deal closing & negotiation | - |
| `svc-analytics` | Metrics & experiments | - |
| `svc-scheduler` | Job scheduling & timers | - |
| `lib-shared` | DTOs, schemas, events, utils | - |
| `infra-migrations` | DB & infra migrations | - |

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18.0.0
- Docker & Docker Compose
- npm >= 9.0.0

### 1. Clone & Install
```bash
git clone <your-repo-url>
cd estatecraft
npm install
```

### 2. Start Infrastructure
```bash
npm run docker:up
```

### 3. Setup Database
```bash
npm run db:migrate
npm run db:seed
```

### 4. Start Development
```bash
npm run dev
```

## 📊 Key Features

### AI-Powered Lead Qualification
- **Smart Scoring**: Multi-factor qualification (budget, timeline, motivation, authority, need)
- **AI Confidence**: Machine learning-based confidence scoring
- **Automated Routing**: Intelligent lead assignment based on agent expertise

### Automated Engagement
- **Multi-Channel**: Email, SMS, WhatsApp, and call automation
- **Template Engine**: Dynamic message personalization
- **Response Tracking**: Real-time engagement monitoring

### Intelligent Follow-up
- **Cadence Management**: Automated follow-up scheduling
- **SLA Monitoring**: Breach detection and escalation
- **Smart Reminders**: Context-aware notification system

### Real-time Analytics
- **Conversion Tracking**: Lead-to-close pipeline analytics
- **Performance Metrics**: Agent and campaign performance
- **Predictive Insights**: AI-driven forecasting

## 🛠️ Development

### Scripts
```bash
npm run dev              # Start all services
npm run build            # Build all packages
npm run test             # Run all tests
npm run lint             # Lint all packages
npm run format           # Format all packages
npm run docker:up        # Start Docker services
npm run docker:down      # Stop Docker services
```

### Environment Variables
Create `.env` files in each service directory:
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/estatecraft

# Message Queue
RABBITMQ_URL=amqp://estatecraft_user:estatecraft_password@localhost:5672/estatecraft_vhost

# Cache
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key

# External Services
SENDGRID_API_KEY=your-sendgrid-key
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
```

## 🧪 Testing Strategy

- **Unit Tests**: Jest for individual service testing
- **Integration Tests**: Supertest for API endpoint testing
- **E2E Tests**: Cypress for full user journey testing
- **Contract Tests**: Pact for service contract validation
- **Load Tests**: k6 for performance testing

## 📈 Performance Goals

- **Conversion Increase**: ≥ +37% lead-to-close conversion
- **Manual Overhead Reduction**: ≤ -60% manual processing
- **Event Processing Errors**: < 0.1%
- **Response Time**: < 200ms for API endpoints

## 🔒 Security & Compliance

- **Authentication**: JWT-based with RBAC
- **Data Protection**: GDPR compliance built-in
- **Audit Logging**: Complete activity tracking
- **Rate Limiting**: DDoS protection
- **Input Validation**: Zod schema validation

## 🚀 Deployment

### Production
```bash
npm run build
docker-compose -f docker-compose.prod.yml up -d
```

### Staging
```bash
npm run build:staging
docker-compose -f docker-compose.staging.yml up -d
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [Wiki](link-to-wiki)
- **Issues**: [GitHub Issues](link-to-issues)
- **Discussions**: [GitHub Discussions](link-to-discussions)

## 🏆 Acknowledgments

- Built with ❤️ by the EstateCraft Team
- Powered by modern web technologies and AI/ML innovations
- Designed for real estate professionals worldwide

---

**Ready to revolutionize your sales process?** 🚀

Get started with EstateCraft today and watch your conversion rates soar!
