import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const COMPANY = 'Summit Ridge Realty';
const CITIES = [
  { city: 'Denver', state: 'CO' },
  { city: 'Boulder', state: 'CO' },
  { city: 'Aspen', state: 'CO' },
  { city: 'Fort Collins', state: 'CO' },
  { city: 'Colorado Springs', state: 'CO' },
];

const FIRST_NAMES = [
  'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason', 'Isabella', 'William',
  'Mia', 'James', 'Charlotte', 'Benjamin', 'Amelia', 'Lucas', 'Harper', 'Henry', 'Evelyn', 'Alexander',
  'Abigail', 'Sebastian', 'Emily', 'Jack', 'Elizabeth', 'Owen', 'Sofia', 'Daniel', 'Avery', 'Matthew',
];
const LAST_NAMES = [
  'Hartley', 'Whitmore', 'Caldwell', 'Prescott', 'Langford', 'Ashford', 'Thornton', 'Blackwood',
  'Sterling', 'Montgomery', 'Fairchild', 'Hawthorne', 'Pemberton', 'Worthington', 'Kensington',
  'Ashworth', 'Chandler', 'Donovan', 'Ellsworth', 'Fitzgerald',
];

const SOURCES = ['WEBSITE', 'REFERRAL', 'SOCIAL_MEDIA', 'EMAIL_CAMPAIGN', 'TRADE_SHOW', 'PARTNER', 'COLD_CALL'] as const;
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
const PROPERTY_TYPES = ['residential', 'commercial', 'land', 'investment'];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPhone(): string {
  const area = 720 + Math.floor(Math.random() * 80);
  const mid = 200 + Math.floor(Math.random() * 800);
  const end = 1000 + Math.floor(Math.random() * 9000);
  return `+1${area}${mid}${end}`;
}

async function main() {
  console.log(`Seeding EstateCraft with ${COMPANY} sample data...`);

  const passwordHash = await bcrypt.hash('password', 12);

  // Admin + manager
  const admin = await prisma.user.upsert({
    where: { email: 'admin@summitridge.demo' },
    update: {},
    create: {
      email: 'admin@summitridge.demo',
      password: passwordHash,
      firstName: 'Rachel',
      lastName: 'Summit',
      role: 'ADMIN',
      phone: '+17205550100',
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@summitridge.demo' },
    update: {},
    create: {
      email: 'manager@summitridge.demo',
      password: passwordHash,
      firstName: 'Marcus',
      lastName: 'Ridge',
      role: 'MANAGER',
      phone: '+17205550101',
    },
  });

  // 20 agents
  const agents: { id: string }[] = [];
  for (let i = 1; i <= 20; i++) {
    const agent = await prisma.user.upsert({
      where: { email: `agent${i}@summitridge.demo` },
      update: {},
      create: {
        email: `agent${i}@summitridge.demo`,
        password: passwordHash,
        firstName: pick(FIRST_NAMES),
        lastName: pick(LAST_NAMES),
        role: 'AGENT',
        phone: randomPhone(),
      },
    });
    agents.push(agent);
  }

  console.log(`Created ${agents.length + 2} users`);

  // Properties
  const properties: { id: string }[] = [];
  for (let i = 0; i < 25; i++) {
    const loc = pick(CITIES);
    const type = pick(PROPERTY_TYPES);
    const price = type === 'commercial'
      ? 800000 + Math.floor(Math.random() * 3000000)
      : 350000 + Math.floor(Math.random() * 1500000);

    const property = await prisma.property.create({
      data: {
        title: `${loc.city} ${type.charAt(0).toUpperCase() + type.slice(1)} Listing #${i + 1}`,
        description: `Beautiful ${type} property in ${loc.city}, ${loc.state}. Listed by ${COMPANY}.`,
        propertyType: type,
        price,
        city: loc.city,
        state: loc.state,
        country: 'USA',
        zipCode: `${80000 + i}`,
        bedrooms: type === 'residential' ? 2 + Math.floor(Math.random() * 4) : undefined,
        bathrooms: type === 'residential' ? 1 + Math.floor(Math.random() * 3) : undefined,
        squareFootage: 1200 + Math.floor(Math.random() * 4000),
        features: ['parking', 'updated kitchen', 'great location'].slice(0, 1 + Math.floor(Math.random() * 3)),
        listingAgentId: pick(agents).id,
        status: pick(['ACTIVE', 'ACTIVE', 'ACTIVE', 'PENDING', 'SOLD'] as const),
      },
    });
    properties.push(property);
  }

  console.log(`Created ${properties.length} properties`);

  // Voice rules
  await prisma.voiceRule.deleteMany();
  const voiceRules = await Promise.all([
    prisma.voiceRule.create({
      data: {
        name: 'High-Score Lead Outreach',
        enabled: true,
        minQualificationScore: 75,
        maxRetries: 3,
        retryDelayMinutes: 30,
        smsFallbackEnabled: true,
        smsFallbackTemplate:
          'Hi {{leadName}}, this is Summit Ridge Realty. We tried calling about your property inquiry. Reply YES to schedule a viewing!',
        outboundInstruction:
          'You are a friendly real estate assistant for Summit Ridge Realty. Greet {{leadName}} warmly, confirm their interest in Colorado properties, and offer to schedule a viewing with one of our agents. Be concise and professional.',
        priority: 10,
      },
    }),
    prisma.voiceRule.create({
      data: {
        name: 'Warm Lead Follow-up',
        enabled: true,
        minQualificationScore: 60,
        maxRetries: 2,
        retryDelayMinutes: 60,
        smsFallbackEnabled: true,
        smsFallbackTemplate:
          'Hi {{leadName}}, Summit Ridge Realty here! We have new listings matching your criteria. Call us back or reply to learn more.',
        outboundInstruction:
          'You are calling on behalf of Summit Ridge Realty. Ask {{leadName}} if they are still interested in properties in Colorado and mention we have new listings available.',
        priority: 5,
      },
    }),
  ]);

  console.log(`Created ${voiceRules.length} voice rules`);

  // 100 leads
  const statuses = ['NEW', 'QUALIFIED', 'ENGAGED', 'FOLLOW_UP', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'] as const;
  const leads: { id: string; phone: string | null; firstName: string; score: number }[] = [];

  for (let i = 0; i < 100; i++) {
    const loc = pick(CITIES);
    const property = pick(properties);
    const agent = pick(agents);
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const score = 30 + Math.floor(Math.random() * 70);
    const status = score >= 75 ? pick(['QUALIFIED', 'ENGAGED', 'FOLLOW_UP'] as const) : pick(statuses);

    const lead = await prisma.lead.create({
      data: {
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.demo`,
        phone: randomPhone(),
        company: i % 5 === 0 ? `${lastName} Holdings` : undefined,
        jobTitle: i % 4 === 0 ? 'Property Investor' : undefined,
        source: pick(SOURCES),
        priority: score >= 80 ? 'HIGH' : pick(PRIORITIES),
        status,
        propertyId: property.id,
        propertyType: 'residential',
        priceMin: 300000,
        priceMax: 800000 + Math.floor(Math.random() * 500000),
        city: loc.city,
        state: loc.state,
        country: 'USA',
        qualificationScore: score,
        aiConfidence: 0.55 + (score / 100) * 0.4,
        assignedTo: agent.id,
        tags: score >= 70 ? ['hot-lead', 'colorado'] : ['nurture'],
        notes: [`Interested in ${loc.city} area properties`],
        nextFollowUp: new Date(Date.now() + Math.random() * 14 * 24 * 60 * 60 * 1000),
        cadence: pick(['daily', 'weekly', 'biweekly'] as const),
      },
    });
    leads.push({ id: lead.id, phone: lead.phone, firstName, score });
  }

  console.log(`Created ${leads.length} leads`);

  // Communication history + score history
  let commCount = 0;
  for (const lead of leads.slice(0, 60)) {
    const numComms = 1 + Math.floor(Math.random() * 4);
    for (let c = 0; c < numComms; c++) {
      const isVoice = Math.random() > 0.4;
      const channel = isVoice ? 'VOICE' : pick(['SMS', 'EMAIL'] as const);
      const status = pick(['COMPLETED', 'DELIVERED', 'NO_ANSWER', 'FAILED', 'IN_PROGRESS'] as const);

      const comm = await prisma.communication.create({
        data: {
          leadId: lead.id,
          channel,
          direction: 'OUTBOUND',
          status,
          provider: isVoice ? 'mock' : 'email',
          content: isVoice
            ? 'Outbound call regarding property inquiry at Summit Ridge Realty'
            : 'Follow-up message about Colorado property listings',
          retryCount: status === 'FAILED' ? 1 : 0,
        },
      });
      commCount++;

      if (isVoice) {
        await prisma.callRecord.create({
          data: {
            communicationId: comm.id,
            externalCallId: `seed-call-${comm.id}`,
            duration: status === 'COMPLETED' ? 60 + Math.floor(Math.random() * 180) : 0,
            outcome: status === 'COMPLETED' ? 'CONNECTED' : status === 'NO_ANSWER' ? 'NO_ANSWER' : 'FAILED',
            transcript:
              status === 'COMPLETED'
                ? 'Agent confirmed interest and scheduled a property viewing for next week.'
                : undefined,
            startedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
            endedAt: new Date(),
          },
        });
      }
    }

    await prisma.leadScoreHistory.create({
      data: {
        leadId: lead.id,
        score: lead.score,
        factors: { budget: 7, timeline: 6, motivation: 7, authority: 6, need: 7 },
        trigger: 'seed',
      },
    });
  }

  // SMS fallbacks for some failed calls
  const failedVoice = await prisma.communication.findMany({
    where: { channel: 'VOICE', status: { in: ['NO_ANSWER', 'FAILED'] } },
    take: 15,
  });

  for (const parent of failedVoice) {
    await prisma.communication.create({
      data: {
        leadId: parent.leadId,
        channel: 'SMS',
        direction: 'OUTBOUND',
        status: 'DELIVERED',
        provider: 'mock',
        parentId: parent.id,
        content: 'Hi! Summit Ridge Realty tried reaching you. Reply to schedule a property viewing.',
      },
    });
    commCount++;
  }

  // Scheduled follow-ups
  for (const lead of leads.slice(0, 40)) {
    await prisma.scheduledFollowUp.create({
      data: {
        leadId: lead.id,
        scheduledAt: new Date(Date.now() + Math.random() * 21 * 24 * 60 * 60 * 1000),
        type: pick(['reminder', 'voice_retry', 'viewing', 'check_in'] as const),
        status: pick(['PENDING', 'PENDING', 'COMPLETED'] as const),
        assignedTo: pick(agents).id,
        notes: 'Automated follow-up from Summit Ridge Realty cadence engine',
      },
    });
  }

  console.log(`Created ${commCount} communications and follow-ups`);
  console.log('\n✅ Seed complete!');
  console.log('\nDemo credentials:');
  console.log('  Admin:   admin@summitridge.demo / password');
  console.log('  Manager: manager@summitridge.demo / password');
  console.log('  Agent:   agent1@summitridge.demo / password');
  console.log(`\nCompany: ${COMPANY} (fictional)`);
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
