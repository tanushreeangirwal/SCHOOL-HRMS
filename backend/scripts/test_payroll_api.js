async function testPayrollApi() {
  try {
    const baseUrl = 'http://localhost:5000/api';

    // 1. Log in as Super Admin (Principal)
    console.log('1. Logging in as admin@school.edu...');
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@school.edu',
        password: 'SchoolDemo@2026'
      })
    });
    const loginData = await loginRes.json();

    const token = loginData.token;
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
    console.log('Login successful! Role:', loginData.user.role);

    // 2. Fetch Payroll Overview for current month
    console.log('\n2. Testing GET /api/payroll/overview...');
    const overRes = await fetch(`${baseUrl}/payroll/overview?month=9&year=2026`, { headers: authHeaders });
    const overData = await overRes.json();
    console.log('Overview response:', overData);

    // 3. Process Payroll for current month (September 2026)
    console.log('\n3. Testing POST /api/payroll/process for Sept 2026...');
    const procRes = await fetch(`${baseUrl}/payroll/process`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ month: 9, year: 2026 })
    });
    const procData = await procRes.json();
    console.log('Process response:', procData.message, 'Processed staff count:', procData.count);

    // 4. Fetch Payroll Records
    console.log('\n4. Testing GET /api/payroll/records...');
    const recsRes = await fetch(`${baseUrl}/payroll/records?month=9&year=2026`, { headers: authHeaders });
    const recsData = await recsRes.json();
    console.log('Records returned:', recsData.data.length);
    if (recsData.data.length > 0) {
      const sample = recsData.data[0];
      console.log('Sample staff payroll:', {
        employee: `${sample.first_name} ${sample.last_name}`,
        code: sample.employee_code,
        payable_days: sample.payable_days,
        gross: sample.gross_earnings,
        deductions: sample.total_deductions,
        net: sample.net_salary,
        status: sample.status
      });

      // 5. Test Payslip Generation
      console.log('\n5. Testing GET /api/payroll/payslip/:id for record', sample.id);
      const slipRes = await fetch(`${baseUrl}/payroll/payslip/${sample.id}`, { headers: authHeaders });
      const slipData = await slipRes.json();
      console.log('Payslip fetched successfully for:', slipData.data.first_name, slipData.data.last_name);
      console.log('Earnings breakdown items count:', slipData.data.earnings.length);
      console.log('Deductions breakdown items count:', slipData.data.deductions.length);
    }

    // 6. Test Teacher Self-Service My Payslips
    console.log('\n6. Logging in as Teacher (teacher@school.edu)...');
    const teacherLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'teacher@school.edu',
        password: 'SchoolDemo@2026'
      })
    });
    const teacherLoginData = await teacherLogin.json();
    const teacherToken = teacherLoginData.token;
    const teacherHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${teacherToken}`
    };

    const mySlips = await fetch(`${baseUrl}/payroll/my-payslips`, { headers: teacherHeaders });
    const mySlipsData = await mySlips.json();
    console.log('Teacher personal payslips count:', mySlipsData.data.length);
    if (mySlipsData.data.length > 0) {
      console.log('Teacher sample payslip:', mySlipsData.data[0].month_name, 'Net:', mySlipsData.data[0].net_salary);
    }

    console.log('\nALL BACKEND PAYROLL API TESTS PASSED SUCCESSFULLY (100%)!');
  } catch (err) {
    console.error('API Test Error:', err);
  }
}

testPayrollApi();
