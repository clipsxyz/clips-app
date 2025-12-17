/**
 * Test script to verify Laravel API integration
 * Run with: node test-laravel-api.js
 */

const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:8000/api';

async function testLaravelAPI() {
  console.log('🧪 Testing Laravel API Integration...\n');
  console.log(`API Base URL: ${API_BASE_URL}\n`);

  const tests = [
    {
      name: 'Health Check',
      endpoint: '/health',
      method: 'GET',
      requiresAuth: false
    },
    {
      name: 'Fetch Posts',
      endpoint: '/posts?cursor=0&limit=5&filter=Dublin',
      method: 'GET',
      requiresAuth: false
    }
  ];

  for (const test of tests) {
    try {
      console.log(`Testing: ${test.name}`);
      console.log(`  Endpoint: ${test.endpoint}`);
      
      const options = {
        method: test.method,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      };

      if (test.requiresAuth) {
        const token = 'test-token'; // In real scenario, get from localStorage
        options.headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}${test.endpoint}`, options);
      const status = response.status;
      const data = await response.json().catch(() => ({ error: 'No JSON response' }));

      if (status >= 200 && status < 300) {
        console.log(`  ✅ Success (${status})`);
        if (data.items) {
          console.log(`  📦 Response: ${data.items.length} items`);
        }
      } else {
        console.log(`  ⚠️  Status: ${status}`);
        console.log(`  Response:`, JSON.stringify(data, null, 2).substring(0, 200));
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
        console.log(`  💡 Tip: Make sure Laravel backend is running on port 8000`);
        console.log(`     Run: cd laravel-backend && php artisan serve`);
      }
    }
    console.log('');
  }

  console.log('📋 Summary:');
  console.log('  - If all tests pass: ✅ Laravel API is working');
  console.log('  - If tests fail: Check Laravel backend is running');
  console.log('  - Frontend will fallback to mock data if API fails');
}

// Run tests
testLaravelAPI().catch(console.error);


















