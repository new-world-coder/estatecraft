import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from './api';

type Tab = 'overview' | 'leads' | 'voice' | 'timeline' | 'rules' | 'properties';

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  status: string;
  priority: string;
  qualificationScore: number;
  city?: string;
  communications?: Array<{ channel: string; status: string; createdAt: string }>;
}

interface VoiceStats {
  totalCalls: number;
  completedCalls: number;
  failedCalls: number;
  smsFallbacks: number;
  successRate: number;
  recentCalls: Array<{
    id: string;
    status: string;
    provider: string;
    createdAt: string;
    lead?: { firstName: string; lastName: string };
    callRecord?: { duration?: number; outcome?: string };
  }>;
}

interface VoiceRule {
  id: string;
  name: string;
  enabled: boolean;
  minQualificationScore: number;
  maxRetries: number;
  retryDelayMinutes: number;
  smsFallbackEnabled: boolean;
  smsFallbackTemplate?: string;
  outboundInstruction: string;
  priority: number;
}

interface Property {
  id: string;
  title: string;
  propertyType: string;
  price: number;
  city: string;
  state: string;
  status: string;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface CreateLeadForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  source: string;
  priority: string;
  city: string;
  state: string;
}

function App() {
  const [tab, setTab] = useState<Tab>('overview');
  const [token, setToken] = useState<string | null>(localStorage.getItem('ec_token'));
  const [user, setUser] = useState<User | null>(null);
  const [loginForm, setLoginForm] = useState({
    tenantSlug: 'summit-ridge',
    email: 'admin@summitridge.demo',
    password: 'password',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [callingLeadId, setCallingLeadId] = useState<string | null>(null);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [voiceStats, setVoiceStats] = useState<VoiceStats | null>(null);
  const [rules, setRules] = useState<VoiceRule[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);

  const [createLeadForm, setCreateLeadForm] = useState<CreateLeadForm>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    source: "WEBSITE",
    priority: "HIGH",
    city: "",
    state: "",
  });
  const [creatingLead, setCreatingLead] = useState(false);

  const [ruleForm, setRuleForm] = useState({
    name: '',
    minQualificationScore: 70,
    maxRetries: 3,
    retryDelayMinutes: 30,
    smsFallbackEnabled: true,
    outboundInstruction: '',
    priority: 0,
  });

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');

      setToken(data.data.token);
      localStorage.setItem('ec_token', data.data.token);
      if (data.data.tenant?.slug) {
        localStorage.setItem('ec_tenant_slug', data.data.tenant.slug);
      }
      setUser(data.data.user);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Login failed. Is the API running on port 3000?'
      );
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('ec_token');
    localStorage.removeItem('ec_tenant_slug');
  };

  const fetchHealth = async () => {
    const res = await apiFetch('/health');
    if (res.ok) setHealth(await res.json());
  };

  const fetchLeads = async () => {
    const res = await apiFetch('/api/leads?limit=100', { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      setLeads(data.data || []);
      if (data.data?.[0]) setSelectedLeadId(data.data[0].id);
    }
  };

  const fetchVoiceStats = async () => {
    const res = await apiFetch('/api/dashboard/stats', { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      setVoiceStats(data.data);
    }
  };

  const fetchRules = async () => {
    const res = await apiFetch('/api/voice-rules', { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      setRules(data.data || []);
    }
  };

  const fetchProperties = async () => {
    const res = await apiFetch('/api/properties', { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      setProperties(data.data || []);
    }
  };

  const fetchTimeline = async (leadId: string) => {
    if (!leadId) return;
    const res = await apiFetch(`/api/communications/timeline/${leadId}`, { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      setTimeline(data.data || []);
    }
  };

  const qualifyLead = async (leadId: string) => {
    setLoading(true);
    await apiFetch(`/api/leads/${leadId}/qualify`, { method: 'POST', headers: authHeaders() });
    await fetchLeads();
    setLoading(false);
  };

  const initiateCall = async (leadId: string) => {
    setCallingLeadId(leadId);
    setError(null);
    setNotice(null);

    try {
      const res = await apiFetch('/api/communications/call', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ leadId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to initiate call');

      setNotice('Call initiated successfully. Check Voice Activity and Timeline for updates.');
      setSelectedLeadId(leadId);
      await fetchVoiceStats();
      await fetchLeads();
      await fetchTimeline(leadId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate call');
    } finally {
      setCallingLeadId(null);
    }
  };

  const createLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingLead(true);
    setError(null);

    try {
      const res = await apiFetch('/api/leads', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(createLeadForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create lead');

      setCreateLeadForm({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        source: "WEBSITE",
        priority: "HIGH",
        city: "",
        state: "",
      });

      await fetchLeads();
      await fetchVoiceStats();
      await fetchTimeline(data.data.id);
      setSelectedLeadId(data.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lead');
    } finally {
      setCreatingLead(false);
    }
  };

  const createRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await apiFetch('/api/voice-rules', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(ruleForm),
    });
    setRuleForm({
      name: '',
      minQualificationScore: 70,
      maxRetries: 3,
      retryDelayMinutes: 30,
      smsFallbackEnabled: true,
      outboundInstruction: '',
      priority: 0,
    });
    await fetchRules();
    setLoading(false);
  };

  useEffect(() => {
    fetchHealth();
    if (token) {
      fetchLeads();
      fetchVoiceStats();
      fetchRules();
      fetchProperties();
    }
  }, [token]);

  useEffect(() => {
    if (selectedLeadId && token) fetchTimeline(selectedLeadId);
  }, [selectedLeadId, token]);

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-slate-900">EstateCraft</h1>
            <p className="text-slate-500 text-sm mt-1">{"{tenant}.estatecraft.io"}</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="text"
              value={loginForm.tenantSlug}
              onChange={(e) => setLoginForm((f) => ({ ...f, tenantSlug: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Workspace slug (e.g. summit-ridge)"
            />
            <input
              type="email"
              value={loginForm.email}
              onChange={(e) => setLoginForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Email"
            />
            <input
              type="password"
              value={loginForm.password}
              onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Password"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <p className="mt-4 text-xs text-slate-500 text-center">
            Demo: summit-ridge / admin@summitridge.demo / password
          </p>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'leads', label: 'Leads' },
    { id: 'voice', label: 'Voice Activity' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'rules', label: 'Voice Rules' },
    { id: 'properties', label: 'Properties' },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">EstateCraft</h1>
          <p className="text-slate-400 text-sm">Summit Ridge Realty — Communication Orchestration</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-300">{user?.firstName} {user?.lastName} ({user?.role})</span>
          <button onClick={logout} className="text-sm bg-slate-700 px-3 py-1 rounded hover:bg-slate-600">
            Logout
          </button>
        </div>
      </header>

      <nav className="bg-white border-b px-6 flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="p-6 max-w-7xl mx-auto">
        {error && <div className="mb-4 p-3 bg-amber-50 text-amber-800 rounded-lg text-sm">{error}</div>}
        {notice && <div className="mb-4 p-3 bg-emerald-50 text-emerald-800 rounded-lg text-sm">{notice}</div>}

        {tab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Calls" value={voiceStats?.totalCalls ?? '—'} />
            <StatCard label="Success Rate" value={`${voiceStats?.successRate ?? 0}%`} />
            <StatCard label="SMS Fallbacks" value={voiceStats?.smsFallbacks ?? '—'} />
            <StatCard label="Active Leads" value={leads.length} />
            <div className="md:col-span-2 lg:col-span-4 bg-white rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold text-slate-800 mb-3">Platform Health</h2>
              {health && (health as any).checks?.database === false && (
                <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                  Production database is not configured. Set <code>DATABASE_URL</code> in Vercel, run Prisma push + seed, then redeploy.
                </div>
              )}
              <pre className="text-xs bg-slate-50 p-4 rounded-lg overflow-auto">
                {JSON.stringify(health, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {tab === 'leads' && (
          <div className="space-y-4">
            <form onSubmit={createLead} className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="font-semibold text-slate-800 mb-3">Create Lead</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="First name" value={createLeadForm.firstName} onChange={(e) => setCreateLeadForm((f) => ({ ...f, firstName: e.target.value }))} required />
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Last name" value={createLeadForm.lastName} onChange={(e) => setCreateLeadForm((f) => ({ ...f, lastName: e.target.value }))} required />
                <input type="email" className="border rounded-lg px-3 py-2 text-sm" placeholder="Email" value={createLeadForm.email} onChange={(e) => setCreateLeadForm((f) => ({ ...f, email: e.target.value }))} required />
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Phone (+1 US for Dial)" value={createLeadForm.phone} onChange={(e) => setCreateLeadForm((f) => ({ ...f, phone: e.target.value }))} required />
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="City" value={createLeadForm.city} onChange={(e) => setCreateLeadForm((f) => ({ ...f, city: e.target.value }))} required />
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="State" value={createLeadForm.state} onChange={(e) => setCreateLeadForm((f) => ({ ...f, state: e.target.value }))} required />
                <select className="border rounded-lg px-3 py-2 text-sm" value={createLeadForm.source} onChange={(e) => setCreateLeadForm((f) => ({ ...f, source: e.target.value }))}>
                  <option value="WEBSITE">WEBSITE</option><option value="REFERRAL">REFERRAL</option><option value="PARTNER">PARTNER</option><option value="SOCIAL_MEDIA">SOCIAL_MEDIA</option>
                </select>
                <select className="border rounded-lg px-3 py-2 text-sm" value={createLeadForm.priority} onChange={(e) => setCreateLeadForm((f) => ({ ...f, priority: e.target.value }))}>
                  <option value="LOW">LOW</option><option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option><option value="URGENT">URGENT</option>
                </select>
              </div>
              <button type="submit" disabled={creatingLead} className="mt-3 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-60">
                {creatingLead ? "Creating..." : "Create Lead"}
              </button>
              <p className="mt-2 text-xs text-slate-500">
                For Dial live calls, use a US number (+1...). Some regions (including +91 India) are blocked until Dial unlocks them.
              </p>
            </form>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-left">Name</th>
                      <th className="px-4 py-3 text-left">Score</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">City</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr key={lead.id} className="border-t">
                        <td className="px-4 py-3">
                          <div className="font-medium">{lead.firstName} {lead.lastName}</div>
                          <div className="text-slate-500 text-xs">{lead.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold ${lead.qualificationScore >= 70 ? 'text-green-600' : 'text-slate-600'}`}>
                            {lead.qualificationScore}
                          </span>
                        </td>
                        <td className="px-4 py-3"><Badge text={lead.status} /></td>
                        <td className="px-4 py-3 text-slate-600">{lead.city || '—'}</td>
                        <td className="px-4 py-3 flex gap-2">
                          <button
                            onClick={() => qualifyLead(lead.id)}
                            className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-100"
                          >
                            Score
                          </button>
                          <button
                            onClick={() => initiateCall(lead.id)}
                            disabled={callingLeadId === lead.id}
                            className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100 disabled:opacity-60"
                          >
                            {callingLeadId === lead.id ? 'Calling...' : 'Call'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden divide-y">
                {leads.map((lead) => (
                  <div key={lead.id} className="p-4">
                    <div className="font-medium text-slate-900">{lead.firstName} {lead.lastName}</div>
                    <div className="text-xs text-slate-500 mt-1">{lead.email}</div>
                    <div className="text-xs text-slate-600 mt-2">{lead.city || '—'} · Score {lead.qualificationScore}</div>
                    <div className="mt-2 flex items-center gap-2"><Badge text={lead.status} /></div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => qualifyLead(lead.id)}
                        className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-100"
                      >
                        Score
                      </button>
                      <button
                        onClick={() => initiateCall(lead.id)}
                        disabled={callingLeadId === lead.id}
                        className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100 disabled:opacity-60"
                      >
                        {callingLeadId === lead.id ? 'Calling...' : 'Call'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'voice' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Completed" value={voiceStats?.completedCalls ?? 0} color="green" />
              <StatCard label="Failed / No Answer" value={voiceStats?.failedCalls ?? 0} color="red" />
              <StatCard label="SMS Fallbacks" value={voiceStats?.smsFallbacks ?? 0} color="amber" />
              <StatCard label="Success Rate" value={`${voiceStats?.successRate ?? 0}%`} color="indigo" />
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-semibold mb-4">Recent Voice Activity</h2>
              <div className="space-y-3">
                {(voiceStats?.recentCalls || []).map((call) => (
                  <div key={call.id} className="flex justify-between items-center border-b pb-3">
                    <div>
                      <div className="font-medium">
                        {call.lead?.firstName} {call.lead?.lastName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(call.createdAt).toLocaleString()} · {call.provider}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge text={call.status} />
                      {call.callRecord?.duration && (
                        <div className="text-xs text-slate-500 mt-1">{call.callRecord.duration}s</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'timeline' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="mb-4">
              <label className="text-sm text-slate-600">Select Lead</label>
              <select
                value={selectedLeadId}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                className="mt-1 block w-full max-w-md border rounded-lg px-3 py-2"
              >
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>{l.firstName} {l.lastName}</option>
                ))}
              </select>
            </div>
            <div className="space-y-4">
              {timeline.map((entry) => (
                <div key={entry.id} className="flex gap-4 items-start border-l-2 border-indigo-200 pl-4">
                  <div className="text-xs text-slate-500 w-36">
                    {new Date(entry.createdAt).toLocaleString()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <ChannelIcon channel={entry.channel} />
                      <Badge text={entry.status} />
                      <span className="text-xs text-slate-400">{entry.provider}</span>
                    </div>
                    {entry.content && <p className="text-sm text-slate-600 mt-1">{entry.content}</p>}
                    {entry.callRecord?.transcript && (
                      <p className="text-xs text-slate-500 mt-1 italic">{entry.callRecord.transcript}</p>
                    )}
                  </div>
                </div>
              ))}
              {timeline.length === 0 && <p className="text-slate-500 text-sm">No communications for this lead.</p>}
            </div>
          </div>
        )}

        {tab === 'rules' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-semibold mb-4">Active Voice Rules</h2>
              <div className="space-y-4">
                {rules.map((rule) => (
                  <div key={rule.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{rule.name}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          Min score: {rule.minQualificationScore} · Retries: {rule.maxRetries} ·
                          SMS fallback: {rule.smsFallbackEnabled ? 'Yes' : 'No'}
                        </div>
                      </div>
                      <Badge text={rule.enabled ? 'ENABLED' : 'DISABLED'} />
                    </div>
                    <p className="text-xs text-slate-600 mt-2 line-clamp-2">{rule.outboundInstruction}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-semibold mb-4">Create Voice Rule</h2>
              <form onSubmit={createRule} className="space-y-3">
                <input
                  placeholder="Rule name"
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  required
                />
                <input
                  type="number"
                  placeholder="Min qualification score"
                  value={ruleForm.minQualificationScore}
                  onChange={(e) => setRuleForm((f) => ({ ...f, minQualificationScore: +e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
                <textarea
                  placeholder="Outbound instruction (use {{leadName}})"
                  value={ruleForm.outboundInstruction}
                  onChange={(e) => setRuleForm((f) => ({ ...f, outboundInstruction: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm h-24"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700"
                >
                  Create Rule
                </button>
              </form>
            </div>
          </div>
        )}

        {tab === 'properties' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {properties.map((p) => (
              <div key={p.id} className="bg-white rounded-xl shadow-sm p-5">
                <div className="font-medium text-slate-800">{p.title}</div>
                <div className="text-indigo-600 font-semibold mt-1">
                  ${p.price.toLocaleString()}
                </div>
                <div className="text-sm text-slate-500 mt-1">{p.city}, {p.state}</div>
                <div className="flex gap-2 mt-3">
                  <Badge text={p.propertyType} />
                  <Badge text={p.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = 'slate',
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  const colors: Record<string, string> = {
    slate: 'text-slate-800',
    green: 'text-green-600',
    red: 'text-red-600',
    amber: 'text-amber-600',
    indigo: 'text-indigo-600',
  };
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${colors[color]}`}>{value}</div>
    </div>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
      {text}
    </span>
  );
}

function ChannelIcon({ channel }: { channel: string }) {
  const icons: Record<string, string> = {
    VOICE: '📞',
    SMS: '💬',
    EMAIL: '📧',
    WHATSAPP: '📱',
  };
  return <span>{icons[channel] || '📋'}</span>;
}

export default App;
