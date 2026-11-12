import { createPlazaApp } from '../src/server/index.js';

async function runSmoke() {
  console.log('[smoke] Starting temporary server on port 3215...');
  const instance = createPlazaApp();
  
  await new Promise((resolve) => {
    instance.server.listen(3215, resolve);
  });
  console.log('[smoke] Server listening on http://localhost:3215');

  try {
    // 1. GET /api/health
    const resHealth = await fetch('http://localhost:3215/api/health');
    const healthJson = await resHealth.json();
    console.log('[smoke] GET /api/health:', healthJson.ok ? 'PASS' : 'FAIL', healthJson);
    if (!healthJson.ok) throw new Error('Health check failed');

    // 2. GET /api/plaza
    const resPlaza = await fetch('http://localhost:3215/api/plaza');
    const plazaJson = await resPlaza.json();
    console.log('[smoke] GET /api/plaza: PASS, floors count:', plazaJson.floors.length, 'activeProjectFloorId:', plazaJson.activeProjectFloorId);
    
    // Find Swarm-Dasboard floor or any floor with employees
    const swarmFloor = plazaJson.floors.find(f => f.workspacePath?.toLowerCase().includes('swarm-dasboard'));
    if (swarmFloor) {
      console.log('[smoke] Found Swarm-Dasboard floor:', swarmFloor.companyName, 'employees:', swarmFloor.employees.map(e => `${e.name} (${e.modelFamily}, ${e.status}, ${e.zone})`));
    } else {
      console.log('[smoke] Swarm-Dasboard floor not found directly; available floors:', plazaJson.floors.map(f => f.companyName));
    }

    // Pick an employee (either from real floors or demo)
    let testAgentId = null;
    for (const f of plazaJson.floors) {
      if (f.employees.length > 0) {
        testAgentId = f.employees[0].id;
        break;
      }
    }

    // 3. POST /api/demo/toggle
    const resDemoToggle = await fetch('http://localhost:3215/api/demo/toggle', { method: 'POST' });
    const demoJson = await resDemoToggle.json();
    console.log('[smoke] POST /api/demo/toggle: PASS, demoMode now:', demoJson.demoMode);
    if (demoJson.demoMode && !testAgentId) {
      testAgentId = 'demo-argon';
    }

    // 4. GET /api/agents/:id/logs
    if (testAgentId) {
      const resLogs = await fetch(`http://localhost:3215/api/agents/${encodeURIComponent(testAgentId)}/logs?limit=5`);
      const logsJson = await resLogs.json();
      console.log(`[smoke] GET /api/agents/${testAgentId}/logs:`, resLogs.status === 200 ? 'PASS' : 'FAIL', 'entries:', logsJson.recentLogs?.length);
    } else {
      console.log('[smoke] Skipping logs check - no agent id found');
    }

    // 5. GET / serving HTML
    const resRoot = await fetch('http://localhost:3215/');
    const htmlText = await resRoot.text();
    const hasHtml =
      resRoot.status === 200 &&
      /<!doctype html>/i.test(htmlText) &&
      htmlText.includes('id="root"');
    console.log('[smoke] GET / serving HTML:', hasHtml ? 'PASS' : 'FAIL', 'length:', htmlText.length);
    if (!hasHtml) throw new Error('Serving root index.html failed');

    console.log('[smoke] ALL 5 SMOKE CHECKS PASSED!');
  } finally {
    console.log('[smoke] Closing temporary server on port 3215...');
    await instance.close();
    console.log('[smoke] Temporary server closed cleanly.');
  }
}

runSmoke().catch((err) => {
  console.error('[smoke] Smoke test error:', err);
  process.exit(1);
});
