async function enrollStaffOnRender() {
  const loginRes = await fetch('https://school-hrms-backend-aukd.onrender.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'principal@school.edu', password: 'SchoolDemo@2026' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;

  // 1. Fetch programs
  const progRes = await fetch('https://school-hrms-backend-aukd.onrender.com/api/training/programs', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const progData = await progRes.json();
  const programs = progData.data || [];
  console.log('Programs on Render:', programs.map(p => ({ id: p.id, title: p.title })));

  // 2. Fetch employees
  const empRes = await fetch('https://school-hrms-backend-aukd.onrender.com/api/employees?limit=100', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const empData = await empRes.json();
  const employees = empData.data?.employees || empData.data || [];
  console.log('Active employees found on Render:', employees.length);

  const empIds = employees.map(e => e.id);
  const teacherIds = employees.slice(0, 14).map(e => e.id);
  const firstAidIds = employees.slice(0, 18).map(e => e.id);

  for (const p of programs) {
    let toEnroll = empIds;
    if (p.title.includes('AI & Digital')) {
      toEnroll = teacherIds;
    } else if (p.title.includes('First Aid')) {
      toEnroll = firstAidIds;
    }

    const enrollRes = await fetch(`https://school-hrms-backend-aukd.onrender.com/api/training/programs/${p.id}/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        employee_ids: toEnroll,
        enrollment_type: p.title.includes('Safety') ? 'Department-wide' : 'Individual',
        enrollment_status: 'Assigned'
      })
    });
    const enrollData = await enrollRes.json();
    console.log(`Enrolled in ${p.title}: status ${enrollRes.status}, count: ${enrollData.enrolled_count || enrollData.data?.length || 'ok'}`);
  }

  // 3. Check final dashboard data
  const dashRes = await fetch('https://school-hrms-backend-aukd.onrender.com/api/training/dashboard', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const dashData = await dashRes.json();
  console.log('\nFINAL DASHBOARD DATA ON RENDER:');
  console.log(JSON.stringify(dashData.data, null, 2));

  // 4. Verify programs list with participant counts
  const progRes2 = await fetch('https://school-hrms-backend-aukd.onrender.com/api/training/programs', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const progData2 = await progRes2.json();
  console.log('\nPROGRAMS LIST WITH ENROLLED COUNTS:');
  progData2.data.forEach(p => {
    console.log(`- [${p.status}] ${p.title} (${p.category}) -> ${p.enrolled_count} participants enrolled`);
  });
}

enrollStaffOnRender().catch(console.error);
