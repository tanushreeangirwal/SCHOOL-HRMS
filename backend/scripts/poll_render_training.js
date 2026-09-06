async function pollRender() {
  console.log('Polling Render training endpoints...');
  for (let i = 1; i <= 25; i++) {
    try {
      const loginRes = await fetch('https://school-hrms-backend-aukd.onrender.com/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'principal@school.edu', password: 'SchoolDemo@2026' })
      });
      const loginData = await loginRes.json();
      const token = loginData.token;

      if (!token) {
        console.log(`Attempt ${i}: Login returned status ${loginRes.status}`);
        await new Promise(r => setTimeout(r, 6000));
        continue;
      }

      const dashRes = await fetch('https://school-hrms-backend-aukd.onrender.com/api/training/dashboard', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const dashData = await dashRes.json();

      const progRes = await fetch('https://school-hrms-backend-aukd.onrender.com/api/training/programs', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const progData = await progRes.json();

      console.log(`Attempt ${i}: Dashboard status ${dashRes.status}, Programs status ${progRes.status}, Programs count: ${progData?.data?.length || 0}`);

      if (dashRes.status === 200 && progRes.status === 200) {
        console.log('SUCCESS! Render training module is live, initialized, and returning 200 OK:');
        console.log('Dashboard Data:', JSON.stringify(dashData.data, null, 2));
        console.log('Programs:', progData.data.map(p => ({ title: p.title, status: p.status, audience: p.target_audience })));
        process.exit(0);
      }
    } catch (err) {
      console.log(`Attempt ${i} error:`, err.message);
    }
    await new Promise(r => setTimeout(r, 8000));
  }
  console.log('Poll loop completed.');
  process.exit(0);
}

pollRender();
