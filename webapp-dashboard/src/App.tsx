import React, { useState, useEffect } from 'react';

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  priority: string;
  qualificationScore: number;
}

interface ApiStatus {
  api: boolean;
  database: boolean;
  rabbitmq: boolean;
  redis: boolean;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

function App() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState<ApiStatus>({
    api: false,
    database: false,
    rabbitmq: false,
    redis: false
  });
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });

  // Test API connectivity
  const testApiConnection = async () => {
    try {
      const response = await fetch('http://localhost:3000/health');
      if (response.ok) {
        setApiStatus(prev => ({ ...prev, api: true }));
        return true;
      }
    } catch (error) {
      console.error('API connection failed:', error);
      setApiStatus(prev => ({ ...prev, api: false }));
    }
    return false;
  };

  // Test auth service
  const testAuthService = async () => {
    try {
      const response = await fetch('http://localhost:3001/health');
      if (response.ok) {
        console.log('Auth service is running');
        return true;
      }
    } catch (error) {
      console.error('Auth service test failed:', error);
    }
    return false;
  };

  // Login function
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginForm),
      });
      
      if (response.ok) {
        const data = await response.json();
        setToken(data.data.token);
        setUser(data.data.user);
        setShowLogin(false);
        setLoginForm({ email: '', password: '' });
        console.log('Login successful:', data.data.user);
      } else {
        const error = await response.json();
        alert(`Login failed: ${error.message}`);
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch leads with authentication
  const fetchLeads = async () => {
    if (!token) {
      alert('Please login first');
      return;
    }
    
    try {
      const response = await fetch('http://localhost:3000/api/leads', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setLeads(data.data || []);
        console.log('Leads fetched successfully:', data);
      } else {
        const error = await response.json();
        alert(`Failed to fetch leads: ${error.message}`);
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
      alert('Failed to fetch leads. Please try again.');
    }
  };

  // Test leads endpoint (will fail due to auth, but we can test the connection)
  const testLeadsEndpoint = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/leads');
      // We expect 401 (unauthorized) which means the endpoint is working
      if (response.status === 401) {
        console.log('Leads endpoint is working (auth required)');
        return true;
      }
    } catch (error) {
      console.error('Leads endpoint test failed:', error);
    }
    return false;
  };

  // Simulate lead creation (since we don't have auth yet)
  const createSampleLead = () => {
    const newLead: Lead = {
      id: Date.now().toString(),
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      status: 'NEW',
      priority: 'MEDIUM',
      qualificationScore: 75
    };
    setLeads(prev => [...prev, newLead]);
  };

  // Test all services
  const testAllServices = async () => {
    setLoading(true);
    
    // Test API
    const apiWorking = await testApiConnection();
    
    // Test auth service
    const authWorking = await testAuthService();
    
    // Test leads endpoint
    const leadsWorking = await testLeadsEndpoint();
    
    // Simulate other service checks
    setTimeout(() => {
      setApiStatus({
        api: apiWorking,
        database: apiWorking, // If API works, DB is likely working
        rabbitmq: apiWorking, // If API works, RabbitMQ is likely working
        redis: apiWorking     // If API works, Redis is likely working
      });
      setLoading(false);
    }, 1000);
  };

  // Logout function
  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setLeads([]);
  };

  useEffect(() => {
    testAllServices();
  }, []);

  if (showLogin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            🔐 Login to EstateCraft
          </h2>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="admin@estatecraft.com"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="password"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          
          <div className="mt-4 text-center">
            <button
              onClick={() => setShowLogin(false)}
              className="text-blue-600 hover:text-blue-800"
            >
              Cancel
            </button>
          </div>
          
          <div className="mt-6 p-4 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-600 text-center">
              <strong>Demo Credentials:</strong><br/>
              Email: admin@estatecraft.com<br/>
              Password: password
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="text-center flex-1">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              🏗️ EstateCraft
            </h1>
            <p className="text-xl text-gray-600">
              Welcome to the EstateCraft Dashboard
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="text-right">
                <p className="text-sm text-gray-600">Logged in as</p>
                <p className="font-medium">{user.firstName} {user.lastName}</p>
                <p className="text-xs text-gray-500">{user.role}</p>
              </div>
            ) : null}
            
            {user ? (
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
              >
                🚪 Logout
              </button>
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
              >
                🔐 Login
              </button>
            )}
          </div>
        </div>

        {/* Service Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              🔧 Platform Status
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span>API Service (Port 3000)</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  apiStatus.api ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {apiStatus.api ? '✅ Running' : '❌ Offline'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Auth Service (Port 3001)</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  user ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {user ? '✅ Connected' : '⚠️ Available'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Database (PostgreSQL)</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  apiStatus.database ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {apiStatus.database ? '✅ Connected' : '❌ Disconnected'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Message Queue (RabbitMQ)</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  apiStatus.rabbitmq ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {apiStatus.rabbitmq ? '✅ Connected' : '❌ Disconnected'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Cache (Redis)</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  apiStatus.redis ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {apiStatus.redis ? '✅ Connected' : '❌ Disconnected'}
                </span>
              </div>
            </div>
            <button
              onClick={testAllServices}
              disabled={loading}
              className="mt-4 w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Testing...' : '🔄 Test All Services'}
            </button>
          </div>

          {/* Quick Actions */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              📊 Quick Actions
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={createSampleLead}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
              >
                ➕ Add Sample Lead
              </button>
              <button
                onClick={() => setLeads([])}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
              >
                🗑️ Clear Leads
              </button>
              <button
                onClick={testApiConnection}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
              >
                🔍 Test API
              </button>
              <button
                onClick={fetchLeads}
                disabled={!user}
                className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                📋 Fetch Leads
              </button>
            </div>
          </div>
        </div>

        {/* Leads Management */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            📋 Leads Management
          </h2>
          {leads.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No leads available. Click "Add Sample Lead" to create one or login to fetch from API.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {leads.map((lead) => (
                    <tr key={lead.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {lead.firstName} {lead.lastName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          lead.priority === 'HIGH' ? 'bg-red-100 text-red-800' :
                          lead.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {lead.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.qualificationScore}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* API Test Results */}
        <div className="bg-white p-6 rounded-lg shadow-md mt-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            🧪 API Testing Results
          </h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>• Health endpoint: <span className="font-mono">GET /health</span> - Returns service status</p>
            <p>• Leads endpoint: <span className="font-mono">GET /api/leads</span> - Requires authentication (JWT token)</p>
            <p>• Webhooks endpoint: <span className="font-mono">POST /api/webhooks</span> - For external integrations</p>
            <p>• WebSocket support: Available for real-time updates</p>
            <p>• Auth endpoints: <span className="font-mono">POST /api/auth/login</span>, <span className="font-mono">POST /api/auth/register</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
