const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function createTemplate() {
  let xlsx;
  try {
    xlsx = require('xlsx');
  } catch (err) {
    console.error('xlsx package not loaded yet:', err.message);
  }

  console.log('Fetching live institutional metadata from St. Vincent\'s database...');
  const [depts, desigs, empTypes, roles, shifts, managers] = await Promise.all([
    pool.query(`
      SELECT d.name, d.code, COALESCE(dc.name, 'Academic Wing') as category 
      FROM departments d 
      LEFT JOIN department_categories dc ON d.category_id = dc.id 
      ORDER BY d.name;
    `),
    pool.query('SELECT name, code FROM designations ORDER BY name;'),
    pool.query('SELECT name FROM employment_types ORDER BY name;'),
    pool.query('SELECT name, description FROM hr_roles ORDER BY name;'),
    pool.query('SELECT name, code, start_time, end_time, working_days FROM shifts ORDER BY name;'),
    pool.query(`
      SELECT e.employee_code, e.first_name, e.last_name, d.name as dept_name, des.name as desig_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      ORDER BY e.employee_code;
    `)
  ]);

  // 1. Instructions Sheet Data
  const instructionsData = [
    ['ST. VINCENT\'S HIGH SCHOOL — EMPLOYEE ONBOARDING & DATA CENTRALIZATION TEMPLATE'],
    ['Version: 1.0 | Academic Year: 2026-2027'],
    [''],
    ['HOW TO USE THIS TEMPLATE:'],
    ['1. Switch to the "Employee_Onboarding" sheet to enter or paste employee records.'],
    ['2. Fields marked with [REQUIRED] must be filled in for every employee.'],
    ['3. Use exact values from the "Reference_Data" sheet for Department, Designation, Employment Type, and System Role.'],
    ['4. Dates must strictly follow YYYY-MM-DD format (e.g., 1988-05-14).'],
    ['5. Work Email must be unique and will be used as the primary login identifier for the Staff Portal.'],
    ['6. If you leave "employee_code" empty, the system will automatically assign the next sequential code (e.g. EMP-1025).'],
    ['7. Once filled, save the file and run: "npm run import:staff" or upload it through the HR Admin portal.'],
    [''],
    ['FIELD DEFINITIONS & FORMATS:'],
    ['Field Name', 'Required?', 'Format / Type', 'Example / Accepted Values', 'Notes'],
    ['employee_code', 'Optional', 'Text (EMP-####)', 'EMP-1025', 'Leave blank for automatic sequential generation'],
    ['first_name', 'REQUIRED', 'Text', 'Rajesh', 'Official first name on identification records'],
    ['middle_name', 'Optional', 'Text', 'Kumar', 'Middle name or initial'],
    ['last_name', 'REQUIRED', 'Text', 'Sharma', 'Official surname'],
    ['gender', 'REQUIRED', 'Text', 'Male / Female / Other', 'Gender for HR and statutory returns'],
    ['date_of_birth', 'REQUIRED', 'Date (YYYY-MM-DD)', '1986-07-24', 'Must be valid calendar date'],
    ['work_email', 'REQUIRED', 'Email address', 'r.sharma@school.edu', 'Institutional email. Used for staff portal login & notifications'],
    ['personal_email', 'Optional', 'Email address', 'rajesh86@gmail.com', 'Secondary email for emergency recovery and invitations'],
    ['phone', 'REQUIRED', '10-digit Number', '9876543210', 'Primary contact number for SMS and 2FA authentication'],
    ['joining_date', 'REQUIRED', 'Date (YYYY-MM-DD)', '2026-06-01', 'Official date of appointment / joining'],
    ['employment_status', 'Optional', 'Text', 'Active / Probation', 'Defaults to "Active" if omitted'],
    ['department_name', 'REQUIRED', 'Lookup (Exact Name)', 'High School Wing', 'Refer to "Reference_Data" sheet'],
    ['designation_name', 'REQUIRED', 'Lookup (Exact Name)', 'Senior Mathematics Teacher', 'Refer to "Reference_Data" sheet'],
    ['employment_type', 'REQUIRED', 'Lookup (Exact Name)', 'Full Time', 'Full Time, Contract, Part Time, Probation'],
    ['system_role', 'Optional', 'Lookup (Exact Name)', 'Employee', 'Employee, Manager, HR, Administrator, Super Admin'],
    ['reporting_manager_code', 'Optional', 'Text (EMP-####)', 'EMP-1005', 'Code of the HOD / Reporting Officer (see Reference_Data)'],
    ['shift_code', 'Optional', 'Text', 'SH-GEN', 'Shift assignment code (defaults to SH-GEN)'],
    ['address', 'Optional', 'Text', 'Flat 402, Royal Palms, Camp', 'Current residential street address'],
    ['city', 'Optional', 'Text', 'Pune', 'Defaults to "Pune"'],
    ['state', 'Optional', 'Text', 'Maharashtra', 'Defaults to "Maharashtra"'],
    ['postal_code', 'Optional', '6-digit PIN', '411001', 'Postal PIN code'],
    ['bank_name', 'Recommended', 'Text', 'State Bank of India', 'Salary disbursement bank'],
    ['account_number', 'Recommended', 'Numeric / Text', '20394857612', 'Bank account number for monthly direct transfer'],
    ['ifsc_code', 'Recommended', '11-character IFSC', 'SBIN0001234', 'Indian Financial System Code for branch'],
    ['account_holder_name', 'Recommended', 'Text', 'Rajesh Kumar Sharma', 'Name as it appears in bank passbook / statement'],
    ['monthly_gross', 'Optional', 'Number (INR)', '65000', 'Gross monthly salary package for payroll baseline'],
    ['annual_ctc', 'Optional', 'Number (INR)', '780000', 'Annual Cost-to-Company (CTC) compensation'],
    ['emergency_contact_name', 'Optional', 'Text', 'Sunita Sharma', 'Primary emergency contact person'],
    ['emergency_relationship', 'Optional', 'Text', 'Spouse / Parent / Sibling', 'Relationship to staff member'],
    ['emergency_phone', 'Optional', '10-digit Number', '9822334455', 'Emergency contact phone number']
  ];

  // 2. Onboarding Template Headers and Sample Data
  const templateHeaders = [
    'employee_code',
    'first_name',
    'middle_name',
    'last_name',
    'gender',
    'date_of_birth',
    'work_email',
    'personal_email',
    'phone',
    'joining_date',
    'employment_status',
    'department_name',
    'designation_name',
    'employment_type',
    'system_role',
    'reporting_manager_code',
    'shift_code',
    'address',
    'city',
    'state',
    'postal_code',
    'bank_name',
    'account_number',
    'ifsc_code',
    'account_holder_name',
    'monthly_gross',
    'annual_ctc',
    'emergency_contact_name',
    'emergency_relationship',
    'emergency_phone'
  ];

  const sampleRows = [
    [
      'EMP-1025',
      'Rajesh',
      'Kumar',
      'Sharma',
      'Male',
      '1986-07-24',
      'r.sharma@school.edu',
      'rajesh.sharma86@gmail.com',
      '9876543210',
      '2026-06-01',
      'Active',
      'High School Wing',
      'Senior Mathematics Teacher',
      'Full Time',
      'Employee',
      'EMP-1005',
      'SH-GEN',
      'Flat 402, Royal Palms, Camp',
      'Pune',
      'Maharashtra',
      '411001',
      'State Bank of India',
      '20394857612',
      'SBIN0001234',
      'Rajesh Kumar Sharma',
      65000,
      780000,
      'Sunita Sharma',
      'Spouse',
      '9822334455'
    ],
    [
      'EMP-1026',
      'Neelam',
      '',
      'Patil',
      'Female',
      '1991-03-15',
      'n.patil@school.edu',
      'neelam.patil@gmail.com',
      '9823456789',
      '2026-06-01',
      'Active',
      'Primary Wing',
      'Primary Class Teacher (Grades 1-3)',
      'Full Time',
      'Employee',
      'EMP-1014',
      'SH-GEN',
      'B-12, Green Acres, Wanowrie',
      'Pune',
      'Maharashtra',
      '411040',
      'HDFC Bank',
      '50100234567890',
      'HDFC0000123',
      'Neelam Patil',
      48000,
      576000,
      'Sanjay Patil',
      'Spouse',
      '9823112233'
    ],
    [
      'EMP-1027',
      'Farhan',
      'Ahmed',
      'Khan',
      'Male',
      '1989-11-04',
      'f.khan@school.edu',
      'farhankhan@outlook.com',
      '9890123456',
      '2026-06-15',
      'Active',
      'Science Laboratories',
      'Physics Lab Instructor',
      'Full Time',
      'Employee',
      'EMP-1008',
      'SH-GEN',
      'House 18, Clover Highlands, NIBM',
      'Pune',
      'Maharashtra',
      '411048',
      'ICICI Bank',
      '004501589234',
      'ICIC0000045',
      'Farhan Ahmed Khan',
      52000,
      624000,
      'Zubair Khan',
      'Brother',
      '9890998877'
    ],
    [
      'EMP-1028',
      'Pooja',
      '',
      'Kulkarni',
      'Female',
      '1994-08-19',
      'p.kulkarni@school.edu',
      'pooja.kulkarni@gmail.com',
      '9867890123',
      '2026-07-01',
      'Probation',
      'Middle School Wing',
      'English & Social Studies Faculty',
      'Full Time',
      'Employee',
      'EMP-1005',
      'SH-GEN',
      'Row House 5, Dahanukar Colony, Kothrud',
      'Pune',
      'Maharashtra',
      '411038',
      'Bank of Maharashtra',
      '60123456789',
      'MAHB0000012',
      'Pooja Kulkarni',
      42000,
      504000,
      'Mahesh Kulkarni',
      'Father',
      '9867001122'
    ],
    [
      'EMP-1029',
      'Anthony',
      'D',
      'Souza',
      'Male',
      '1985-02-10',
      'a.dsouza@school.edu',
      'anthony.dsouza@yahoo.com',
      '9811223344',
      '2026-06-01',
      'Active',
      'Physical Education & Sports',
      'Physical Education Teacher',
      'Full Time',
      'Employee',
      'EMP-1023',
      'SH-MORN',
      'St. Patrick\'s Compound, Camp',
      'Pune',
      'Maharashtra',
      '411001',
      'Axis Bank',
      '912010045678901',
      'UTIB0000015',
      'Anthony D Souza',
      46000,
      552000,
      'Mary D Souza',
      'Mother',
      '9811998877'
    ]
  ];

  // 3. Reference Data Sheet
  const refData = [
    ['ST. VINCENT\'S HIGH SCHOOL — INSTITUTIONAL REFERENCE VALUES'],
    ['(Copy and paste exact values into the onboarding sheet)'],
    [''],
    ['DEPARTMENTS (department_name)', 'CATEGORY', 'DEPARTMENT CODE', '', 'DESIGNATIONS (designation_name)', 'DESIGNATION CODE'],
    ...Array.from({ length: Math.max(depts.rows.length, desigs.rows.length) }).map((_, i) => {
      const d = depts.rows[i] || {};
      const des = desigs.rows[i] || {};
      return [
        d.name || '',
        d.category || '',
        d.code || '',
        '',
        des.name || '',
        des.code || ''
      ];
    }),
    [''],
    ['EMPLOYMENT TYPES (employment_type)', '', 'SYSTEM ROLES (system_role)', 'ROLE DESCRIPTION'],
    ...Array.from({ length: Math.max(empTypes.rows.length, roles.rows.length) }).map((_, i) => {
      const et = empTypes.rows[i] || {};
      const r = roles.rows[i] || {};
      return [
        et.name || '',
        '',
        r.name || '',
        r.description || ''
      ];
    }),
    [''],
    ['CURRENT SHIFTS (shift_code)', 'SHIFT NAME', 'TIMING', 'WORKING DAYS'],
    ...shifts.rows.map(s => [
      s.code,
      s.name,
      `${s.start_time || '07:30'} - ${s.end_time || '14:30'}`,
      s.working_days ? (Array.isArray(s.working_days) ? s.working_days.join(', ') : JSON.stringify(s.working_days)) : 'Mon-Fri'
    ]),
    [''],
    ['EXISTING STAFF / REPORTING MANAGERS (reporting_manager_code)', 'STAFF NAME', 'DEPARTMENT', 'DESIGNATION'],
    ...managers.rows.map(m => [
      m.employee_code,
      `${m.first_name} ${m.last_name || ''}`.trim(),
      m.dept_name || '',
      m.desig_name || ''
    ])
  ];

  // Generate CSV version first
  const csvRows = [
    templateHeaders.join(','),
    ...sampleRows.map(row => row.map(val => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(','))
  ];

  const projectRoot = path.resolve(__dirname, '..', '..');
  const csvPath = path.join(projectRoot, 'Employee_Onboarding_Template.csv');
  fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf8');
  console.log(`[PASS] Created CSV template: ${csvPath}`);

  // Generate XLSX if available
  if (xlsx) {
    const wb = xlsx.utils.book_new();

    // Sheet 1: Onboarding Sheet
    const wsOnboardingData = [templateHeaders, ...sampleRows];
    const wsOnboarding = xlsx.utils.aoa_to_sheet(wsOnboardingData);

    // Set column widths
    wsOnboarding['!cols'] = templateHeaders.map(h => ({
      wch: Math.max(h.length + 4, 16)
    }));

    // Sheet 2: Reference Data
    const wsRef = xlsx.utils.aoa_to_sheet(refData);
    wsRef['!cols'] = [
      { wch: 34 },
      { wch: 22 },
      { wch: 18 },
      { wch: 4 },
      { wch: 38 },
      { wch: 18 }
    ];

    // Sheet 3: Instructions
    const wsInstructions = xlsx.utils.aoa_to_sheet(instructionsData);
    wsInstructions['!cols'] = [
      { wch: 26 },
      { wch: 14 },
      { wch: 22 },
      { wch: 32 },
      { wch: 60 }
    ];

    xlsx.utils.book_append_sheet(wb, wsInstructions, 'Instructions');
    xlsx.utils.book_append_sheet(wb, wsOnboarding, 'Employee_Onboarding');
    xlsx.utils.book_append_sheet(wb, wsRef, 'Reference_Data');

    const xlsxPath = path.join(projectRoot, 'Employee_Onboarding_Template.xlsx');
    xlsx.writeFile(wb, xlsxPath);
    console.log(`[PASS] Created multi-tab Excel template: ${xlsxPath}`);
  }

  await pool.end();
  console.log('Template generation completed successfully.');
}

createTemplate().catch(err => {
  console.error('Failed to create template:', err);
  process.exit(1);
});
