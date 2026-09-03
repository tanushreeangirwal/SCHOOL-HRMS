const pool = require('../db');

async function seedRealisticWorkforce() {
  console.log('================================================================');
  console.log('--- SEEDING REALISTIC ST. VINCENT\'S SCHOOL WORKFORCE ---');
  console.log('================================================================\n');

  try {
    // -----------------------------------------------------------------------
    // 1. SEED / VERIFY BRANCH
    // -----------------------------------------------------------------------
    console.log('--- 1. BRANCH SETUP ---');
    const branchRes = await pool.query(`
      INSERT INTO branches (id, name, code, address, is_active, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        address = EXCLUDED.address,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, code;
    `, [
      "St. Vincent's High School Campus",
      'BR-MAIN',
      "St. Vincent's High School Campus, 2005 St. Vincent's Street, Camp, Pune, Maharashtra 411001"
    ]);
    const branchId = branchRes.rows[0].id;
    console.log(`✓ Main Branch ID: ${branchId}`);

    // -----------------------------------------------------------------------
    // 2. SEED / VERIFY EMPLOYMENT TYPES
    // -----------------------------------------------------------------------
    console.log('\n--- 2. EMPLOYMENT TYPES ---');
    const employmentTypes = [
      { name: 'Full Time', description: 'Permanent full-time institutional faculty or staff' },
      { name: 'Part Time', description: 'Part-time faculty or visiting specialist' },
      { name: 'Contract', description: 'Fixed-term contract or project-based appointment' },
      { name: 'Probation', description: 'Initial review period appointment for new joiners' }
    ];

    const empTypeMap = {};
    for (const et of employmentTypes) {
      const etRes = await pool.query(`
        INSERT INTO employment_types (id, name, description, is_active, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (name) DO UPDATE SET
          description = EXCLUDED.description,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, name;
      `, [et.name, et.description]);
      empTypeMap[et.name] = etRes.rows[0].id;
      console.log(`✓ Employment Type: "${et.name}" (${empTypeMap[et.name]})`);
    }

    // -----------------------------------------------------------------------
    // 3. FETCH DEPARTMENTS
    // -----------------------------------------------------------------------
    console.log('\n--- 3. FETCH DEPARTMENTS ---');
    const deptsRes = await pool.query('SELECT id, name, code FROM departments;');
    const deptMap = {};
    deptsRes.rows.forEach(d => { deptMap[d.code] = d.id; });
    console.log(`✓ Loaded ${deptsRes.rows.length} departments:`, Object.keys(deptMap));

    // -----------------------------------------------------------------------
    // 4. SEED / VERIFY DESIGNATIONS
    // -----------------------------------------------------------------------
    console.log('\n--- 4. DESIGNATIONS SETUP ---');
    const designations = [
      { name: 'Principal & Institutional Head', code: 'DESIG-PRIN', dept: 'DEPT-ADMIN', desc: 'Executive head of institution and academic governance' },
      { name: 'School Administrator', code: 'DESIG-ADMIN', dept: 'DEPT-ADMIN', desc: 'Head of school operations, campus facilities, and general administration' },
      { name: 'HR Officer', code: 'DESIG-HR', dept: 'DEPT-ADMIN', desc: 'Human resources management, staffing records, and employee welfare' },
      { name: 'Finance & Accounts Officer', code: 'DESIG-FIN', dept: 'DEPT-ADMIN', desc: 'Institutional budgeting, fee records, procurement, and payroll accounts' },
      { name: 'Admissions & Front Desk Executive', code: 'DESIG-ADMISS', dept: 'DEPT-ADMIN', desc: 'Student admissions, parent enquiry desk, and visitor coordination' },

      { name: 'Head of Department (HOD) - Science', code: 'DESIG-HOD-SCI', dept: 'DEPT-SCI', desc: 'Academic head of Science and Mathematics faculty' },
      { name: 'Senior Mathematics Teacher', code: 'DESIG-SR-MATH', dept: 'DEPT-SCI', desc: 'Secondary school Mathematics educator and curriculum mentor' },
      { name: 'Physics Teacher', code: 'DESIG-PHY-TCHR', dept: 'DEPT-SCI', desc: 'Secondary Physics lecturer and laboratory practicals instructor' },
      { name: 'Chemistry & Biology Teacher', code: 'DESIG-CHEM-TCHR', dept: 'DEPT-SCI', desc: 'Chemistry and Biology teacher for secondary divisions' },
      { name: 'Science Laboratory Assistant', code: 'DESIG-LAB-ASST', dept: 'DEPT-SCI', desc: 'Equipment maintenance, chemical safety, and lab preparation' },

      { name: 'Head of Department (HOD) - Humanities', code: 'DESIG-HOD-HUM', dept: 'DEPT-HUM', desc: 'Academic head of Humanities and Languages faculty' },
      { name: 'Senior English Teacher', code: 'DESIG-ENG-TCHR', dept: 'DEPT-HUM', desc: 'English literature, grammar, and debate society coordinator' },
      { name: 'Social Studies & History Teacher', code: 'DESIG-SST-TCHR', dept: 'DEPT-HUM', desc: 'History, Civics, Geography, and social science instruction' },
      { name: 'Hindi & Regional Language Teacher', code: 'DESIG-LANG-TCHR', dept: 'DEPT-HUM', desc: 'Hindi and Marathi language instruction and cultural programs' },

      { name: 'Primary Wing Coordinator', code: 'DESIG-PRI-COORD', dept: 'DEPT-PRI', desc: 'Head of primary school section, curriculum pacing, and junior teachers' },
      { name: 'Primary Class Teacher (Grades 4-5)', code: 'DESIG-PRI-TCHR-SR', dept: 'DEPT-PRI', desc: 'Class teacher for senior primary grades, core subject instruction' },
      { name: 'Primary Class Teacher (Grades 1-3)', code: 'DESIG-PRI-TCHR-JR', dept: 'DEPT-PRI', desc: 'Foundational literacy, numeracy, and classroom care' },
      { name: 'Junior Activity & Arts Instructor', code: 'DESIG-ARTS-INST', dept: 'DEPT-PRI', desc: 'Art, craft, creative activities, and elementary music' },

      { name: 'IT Systems Administrator', code: 'DESIG-IT-ADMIN', dept: 'DEPT-IT', desc: 'Campus network administrator, server management, and IT infrastructure' },
      { name: 'Computer Science Instructor', code: 'DESIG-CS-INST', dept: 'DEPT-IT', desc: 'Computer science, coding curriculum, and IT lab teacher' },
      { name: 'Digital Classroom Tech Support', code: 'DESIG-TECH-SUPP', dept: 'DEPT-IT', desc: 'Smart board maintenance, audio-visual support, and computer lab assistance' },

      { name: 'Sports Director & Head Coach', code: 'DESIG-SPORTS-DIR', dept: 'DEPT-PE', desc: 'Physical education head, sports curriculum, and athletic development' },
      { name: 'Physical Education Teacher', code: 'DESIG-PET', dept: 'DEPT-PE', desc: 'Daily physical training, yoga, and gymnastics instructor' },
      { name: 'Athletics Coach & Team Trainer', code: 'DESIG-COACH', dept: 'DEPT-PE', desc: 'Football, basketball, and track & field inter-school championship coach' }
    ];

    const desigMap = {};
    for (const d of designations) {
      const deptId = deptMap[d.dept] || null;
      const res = await pool.query(`
        INSERT INTO designations (id, name, code, department_id, description, is_active, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          department_id = EXCLUDED.department_id,
          description = EXCLUDED.description,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, code;
      `, [d.name, d.code, deptId, d.desc]);
      desigMap[d.code] = res.rows[0].id;
      console.log(`✓ Designation: "${d.name}" (${d.code})`);
    }

    // -----------------------------------------------------------------------
    // 5. DEFINE REALISTIC WORKFORCE DATA
    // -----------------------------------------------------------------------
    console.log('\n--- 5. PREPARING 22 REALISTIC SCHOOL EMPLOYEES ---');

    const workforce = [
      // 1. Leadership & Administration
      {
        code: 'STV-1001',
        first_name: 'Anthony',
        middle_name: 'Francis',
        last_name: 'Fernandes',
        dob: '1974-05-14',
        gender: 'Male',
        personal_email: 'anthony.fernandes@school.example',
        work_email: 'principal@school.edu',
        phone: '+91 98220 11001',
        address: "Staff Quarters A-1, St. Vincent's Campus, Camp",
        city: 'Pune', state: 'Maharashtra', postal_code: '411001',
        dept_code: 'DEPT-ADMIN',
        desig_code: 'DESIG-PRIN',
        emp_type: 'Full Time',
        joining_date: '2018-06-01',
        status: 'Active',
        manager_code: null
      },
      {
        code: 'STV-1002',
        first_name: 'Rajesh',
        middle_name: 'Gopal',
        last_name: 'Kulkarni',
        dob: '1979-11-20',
        gender: 'Male',
        personal_email: 'rajesh.kulkarni@school.example',
        work_email: 'admin@school.edu',
        phone: '+91 98220 11002',
        address: 'Flat 402, Shanti Heights, Model Colony',
        city: 'Pune', state: 'Maharashtra', postal_code: '411016',
        dept_code: 'DEPT-ADMIN',
        desig_code: 'DESIG-ADMIN',
        emp_type: 'Full Time',
        joining_date: '2019-04-15',
        status: 'Active',
        manager_code: 'STV-1001'
      },
      {
        code: 'EMP-1003',
        first_name: 'Tanushree',
        middle_name: null,
        last_name: 'Angirwal',
        dob: '1988-08-25',
        gender: 'Female',
        personal_email: 'tanushree.a@school.example',
        work_email: 'hr@school.edu',
        phone: '+91 98220 11003',
        address: 'B-14, Silver Oak Residency, Kalyani Nagar',
        city: 'Pune', state: 'Maharashtra', postal_code: '411006',
        dept_code: 'DEPT-ADMIN',
        desig_code: 'DESIG-HR',
        emp_type: 'Full Time',
        joining_date: '2021-07-01',
        status: 'Active',
        manager_code: 'STV-1002'
      },
      {
        code: 'STV-1014',
        first_name: 'Suresh',
        middle_name: 'Ramamurthy',
        last_name: 'Nair',
        dob: '1982-03-12',
        gender: 'Male',
        personal_email: 'suresh.nair@school.example',
        work_email: 'accounts@school.edu',
        phone: '+91 98220 11014',
        address: 'Flat 12, Mayur Apartments, Erandwane',
        city: 'Pune', state: 'Maharashtra', postal_code: '411004',
        dept_code: 'DEPT-ADMIN',
        desig_code: 'DESIG-FIN',
        emp_type: 'Full Time',
        joining_date: '2020-09-01',
        status: 'Active',
        manager_code: 'STV-1002'
      },
      {
        code: 'STV-1015',
        first_name: 'Pooja',
        middle_name: 'Santosh',
        last_name: 'Deshmukh',
        dob: '1992-06-18',
        gender: 'Female',
        personal_email: 'pooja.deshmukh@school.example',
        work_email: 'reception@school.edu',
        phone: '+91 98220 11015',
        address: 'Row House 5, Hermes Heritage, Shastri Nagar',
        city: 'Pune', state: 'Maharashtra', postal_code: '411006',
        dept_code: 'DEPT-ADMIN',
        desig_code: 'DESIG-ADMISS',
        emp_type: 'Full Time',
        joining_date: '2023-01-10',
        status: 'Active',
        manager_code: 'STV-1002'
      },

      // 2. Science & Mathematics Faculty (5 Staff)
      {
        code: 'EMP-1001',
        first_name: 'Eleanor',
        middle_name: 'Marie',
        last_name: 'Vance',
        dob: '1983-02-14',
        gender: 'Female',
        personal_email: 'eleanor.vance@school.example',
        work_email: 'eleanor.vance@school.edu',
        phone: '+91 98220 11004',
        address: "Staff Quarters B-3, St. Vincent's Campus, Camp",
        city: 'Pune', state: 'Maharashtra', postal_code: '411001',
        dept_code: 'DEPT-SCI',
        desig_code: 'DESIG-HOD-SCI',
        emp_type: 'Full Time',
        joining_date: '2019-06-10',
        status: 'Active',
        manager_code: 'STV-1001'
      },
      {
        code: 'STV-1005',
        first_name: 'Amit',
        middle_name: 'Kishore',
        last_name: 'Sharma',
        dob: '1986-09-28',
        gender: 'Male',
        personal_email: 'amit.sharma@school.example',
        work_email: 'amit.sharma@school.edu',
        phone: '+91 98220 11005',
        address: 'Plot 45, Gulmohar Park, Aundh',
        city: 'Pune', state: 'Maharashtra', postal_code: '411007',
        dept_code: 'DEPT-SCI',
        desig_code: 'DESIG-SR-MATH',
        emp_type: 'Full Time',
        joining_date: '2020-06-15',
        status: 'Active',
        manager_code: 'EMP-1001'
      },
      {
        code: 'STV-1006',
        first_name: 'Vikram',
        middle_name: 'Dattatray',
        last_name: 'Joshi',
        dob: '1989-12-04',
        gender: 'Male',
        personal_email: 'vikram.joshi@school.example',
        work_email: 'vikram.joshi@school.edu',
        phone: '+91 98220 11006',
        address: 'Flat 304, Swapnanagari, Kothrud',
        city: 'Pune', state: 'Maharashtra', postal_code: '411038',
        dept_code: 'DEPT-SCI',
        desig_code: 'DESIG-PHY-TCHR',
        emp_type: 'Full Time',
        joining_date: '2021-08-01',
        status: 'Active',
        manager_code: 'EMP-1001'
      },
      {
        code: 'STV-1007',
        first_name: 'Neha',
        middle_name: 'Pravin',
        last_name: 'Patil',
        dob: '1991-04-19',
        gender: 'Female',
        personal_email: 'neha.patil@school.example',
        work_email: 'neha.patil@school.edu',
        phone: '+91 98220 11007',
        address: '22/B, Sahakar Nagar No. 2, Parvati',
        city: 'Pune', state: 'Maharashtra', postal_code: '411009',
        dept_code: 'DEPT-SCI',
        desig_code: 'DESIG-CHEM-TCHR',
        emp_type: 'Full Time',
        joining_date: '2023-06-05',
        status: 'Probation',
        manager_code: 'EMP-1001'
      },
      {
        code: 'STV-1008',
        first_name: 'Rohan',
        middle_name: 'Shankar',
        last_name: 'Shinde',
        dob: '1994-07-22',
        gender: 'Male',
        personal_email: 'rohan.shinde@school.example',
        work_email: 'rohan.shinde@school.edu',
        phone: '+91 98220 11008',
        address: '15/A, Ghorpadi Bazar, Camp Area',
        city: 'Pune', state: 'Maharashtra', postal_code: '411001',
        dept_code: 'DEPT-SCI',
        desig_code: 'DESIG-LAB-ASST',
        emp_type: 'Full Time',
        joining_date: '2022-11-01',
        status: 'Active',
        manager_code: 'EMP-1001'
      },

      // 3. Humanities & Languages Faculty (4 Staff)
      {
        code: 'EMP-1002',
        first_name: 'Marcus',
        middle_name: 'David',
        last_name: 'Thorne',
        dob: '1981-10-15',
        gender: 'Male',
        personal_email: 'marcus.thorne@school.example',
        work_email: 'marcus.thorne@school.edu',
        phone: '+91 98220 11009',
        address: "Staff Quarters B-4, St. Vincent's Campus, Camp",
        city: 'Pune', state: 'Maharashtra', postal_code: '411001',
        dept_code: 'DEPT-HUM',
        desig_code: 'DESIG-HOD-HUM',
        emp_type: 'Full Time',
        joining_date: '2019-06-01',
        status: 'Active',
        manager_code: 'STV-1001'
      },
      {
        code: 'STV-1009',
        first_name: 'Priya',
        middle_name: 'Anand',
        last_name: 'Kulkarni',
        dob: '1987-01-30',
        gender: 'Female',
        personal_email: 'priya.kulkarni@school.example',
        work_email: 'priya.kulkarni@school.edu',
        phone: '+91 98220 11010',
        address: 'Flat 101, Parijat Enclave, Deccan Gymkhana',
        city: 'Pune', state: 'Maharashtra', postal_code: '411004',
        dept_code: 'DEPT-HUM',
        desig_code: 'DESIG-ENG-TCHR',
        emp_type: 'Full Time',
        joining_date: '2020-07-15',
        status: 'Active',
        manager_code: 'EMP-1002'
      },
      {
        code: 'STV-1010',
        first_name: 'Sanjay',
        middle_name: 'Kumar',
        last_name: 'Verma',
        dob: '1985-08-11',
        gender: 'Male',
        personal_email: 'sanjay.verma@school.example',
        work_email: 'sanjay.verma@school.edu',
        phone: '+91 98220 11011',
        address: 'Flat 502, Green Acre, Wanowrie',
        city: 'Pune', state: 'Maharashtra', postal_code: '411040',
        dept_code: 'DEPT-HUM',
        desig_code: 'DESIG-SST-TCHR',
        emp_type: 'Full Time',
        joining_date: '2021-06-20',
        status: 'Active',
        manager_code: 'EMP-1002'
      },
      {
        code: 'STV-1011',
        first_name: 'Sneha',
        middle_name: 'Rajendra',
        last_name: 'Mehta',
        dob: '1990-11-09',
        gender: 'Female',
        personal_email: 'sneha.mehta@school.example',
        work_email: 'sneha.mehta@school.edu',
        phone: '+91 98220 11012',
        address: 'Flat 204, Ganga Satellite, Wanowrie',
        city: 'Pune', state: 'Maharashtra', postal_code: '411040',
        dept_code: 'DEPT-HUM',
        desig_code: 'DESIG-LANG-TCHR',
        emp_type: 'Part Time',
        joining_date: '2022-08-10',
        status: 'Active',
        manager_code: 'EMP-1002'
      },

      // 4. Primary Wing (4 Staff)
      {
        code: 'STV-1012',
        first_name: 'Anjali',
        middle_name: 'Suhas',
        last_name: 'More',
        dob: '1980-04-12',
        gender: 'Female',
        personal_email: 'anjali.more@school.example',
        work_email: 'anjali.more@school.edu',
        phone: '+91 98220 11013',
        address: 'Bungalow 7, Sindh Society, Aundh',
        city: 'Pune', state: 'Maharashtra', postal_code: '411007',
        dept_code: 'DEPT-PRI',
        desig_code: 'DESIG-PRI-COORD',
        emp_type: 'Full Time',
        joining_date: '2018-06-15',
        status: 'Active',
        manager_code: 'STV-1001'
      },
      {
        code: 'STV-1013',
        first_name: 'Kavita',
        middle_name: 'Shashikant',
        last_name: 'Rao',
        dob: '1988-05-23',
        gender: 'Female',
        personal_email: 'kavita.rao@school.example',
        work_email: 'kavita.rao@school.edu',
        phone: '+91 98220 11016',
        address: 'Flat 12, Rahul Complex, Kothrud',
        city: 'Pune', state: 'Maharashtra', postal_code: '411038',
        dept_code: 'DEPT-PRI',
        desig_code: 'DESIG-PRI-TCHR-SR',
        emp_type: 'Full Time',
        joining_date: '2021-06-01',
        status: 'Active',
        manager_code: 'STV-1012'
      },
      {
        code: 'STV-1016',
        first_name: 'Deepak',
        middle_name: 'Baban',
        last_name: 'Sawant',
        dob: '1993-02-17',
        gender: 'Male',
        personal_email: 'deepak.sawant@school.example',
        work_email: 'deepak.sawant@school.edu',
        phone: '+91 98220 11017',
        address: 'Flat 3B, Sunshine Court, Tingre Nagar',
        city: 'Pune', state: 'Maharashtra', postal_code: '411032',
        dept_code: 'DEPT-PRI',
        desig_code: 'DESIG-PRI-TCHR-JR',
        emp_type: 'Full Time',
        joining_date: '2024-01-15',
        status: 'Probation',
        manager_code: 'STV-1012'
      },
      {
        code: 'STV-1017',
        first_name: 'Meera',
        middle_name: 'Venkatesh',
        last_name: 'Iyer',
        dob: '1995-10-08',
        gender: 'Female',
        personal_email: 'meera.iyer@school.example',
        work_email: 'meera.iyer@school.edu',
        phone: '+91 98220 11018',
        address: 'Flat 8, Kasturba Housing Society, Vishrantwadi',
        city: 'Pune', state: 'Maharashtra', postal_code: '411015',
        dept_code: 'DEPT-PRI',
        desig_code: 'DESIG-ARTS-INST',
        emp_type: 'Contract',
        joining_date: '2023-07-01',
        status: 'Active',
        manager_code: 'STV-1012'
      },

      // 5. IT Support & Computer Labs (3 Staff)
      {
        code: 'STV-1018',
        first_name: 'Vivek',
        middle_name: 'Mahesh',
        last_name: 'Shah',
        dob: '1987-07-14',
        gender: 'Male',
        personal_email: 'vivek.shah@school.example',
        work_email: 'it.admin@school.edu',
        phone: '+91 98220 11019',
        address: 'Flat 601, Marvel Fria, Wagholi',
        city: 'Pune', state: 'Maharashtra', postal_code: '412207',
        dept_code: 'DEPT-IT',
        desig_code: 'DESIG-IT-ADMIN',
        emp_type: 'Full Time',
        joining_date: '2020-01-10',
        status: 'Active',
        manager_code: 'STV-1002'
      },
      {
        code: 'STV-1019',
        first_name: 'Ritu',
        middle_name: 'Nilesh',
        last_name: 'Deshpande',
        dob: '1992-03-29',
        gender: 'Female',
        personal_email: 'ritu.deshpande@school.example',
        work_email: 'ritu.deshpande@school.edu',
        phone: '+91 98220 11020',
        address: 'Row House 3, Clover Highlands, NIBM Road',
        city: 'Pune', state: 'Maharashtra', postal_code: '411048',
        dept_code: 'DEPT-IT',
        desig_code: 'DESIG-CS-INST',
        emp_type: 'Full Time',
        joining_date: '2022-06-15',
        status: 'Active',
        manager_code: 'STV-1018'
      },
      {
        code: 'STV-1020',
        first_name: 'Nikhil',
        middle_name: 'Chandrakant',
        last_name: 'Gokhale',
        dob: '1996-12-11',
        gender: 'Male',
        personal_email: 'nikhil.gokhale@school.example',
        work_email: 'techsupport@school.edu',
        phone: '+91 98220 11021',
        address: 'Flat 14, Shri Ganesh Society, Dhayari',
        city: 'Pune', state: 'Maharashtra', postal_code: '411041',
        dept_code: 'DEPT-IT',
        desig_code: 'DESIG-TECH-SUPP',
        emp_type: 'Full Time',
        joining_date: '2024-06-01',
        status: 'Active',
        manager_code: 'STV-1018'
      },

      // 6. Physical Education & Sports (3 Staff)
      {
        code: 'EMP-1004',
        first_name: 'David',
        middle_name: 'Joseph',
        last_name: 'Miller',
        dob: '1984-06-22',
        gender: 'Male',
        personal_email: 'david.miller@school.example',
        work_email: 'david.miller@school.edu',
        phone: '+91 98220 11022',
        address: "Staff Quarters C-2, St. Vincent's Campus, Camp",
        city: 'Pune', state: 'Maharashtra', postal_code: '411001',
        dept_code: 'DEPT-PE',
        desig_code: 'DESIG-SPORTS-DIR',
        emp_type: 'Full Time',
        joining_date: '2019-06-01',
        status: 'Active',
        manager_code: 'STV-1001'
      },
      {
        code: 'STV-1021',
        first_name: 'Ajay',
        middle_name: 'Maruti',
        last_name: 'Jadhav',
        dob: '1990-09-15',
        gender: 'Male',
        personal_email: 'ajay.jadhav@school.example',
        work_email: 'ajay.jadhav@school.edu',
        phone: '+91 98220 11023',
        address: 'Flat 202, Shivneri Heights, Hadapsar',
        city: 'Pune', state: 'Maharashtra', postal_code: '411028',
        dept_code: 'DEPT-PE',
        desig_code: 'DESIG-PET',
        emp_type: 'Full Time',
        joining_date: '2022-07-01',
        status: 'Active',
        manager_code: 'EMP-1004'
      },
      {
        code: 'STV-1022',
        first_name: 'Sunita',
        middle_name: 'Tanaji',
        last_name: 'Gaikwad',
        dob: '1994-01-05',
        gender: 'Female',
        personal_email: 'sunita.gaikwad@school.example',
        work_email: 'sunita.gaikwad@school.edu',
        phone: '+91 98220 11024',
        address: 'Plot 18, Malwadi, Hadapsar',
        city: 'Pune', state: 'Maharashtra', postal_code: '411028',
        dept_code: 'DEPT-PE',
        desig_code: 'DESIG-COACH',
        emp_type: 'Contract',
        joining_date: '2023-08-15',
        status: 'Active',
        manager_code: 'EMP-1004'
      }
    ];

    // -----------------------------------------------------------------------
    // 6. UPSERT EMPLOYEES (FIRST PASS: WITHOUT MANAGER IDS)
    // -----------------------------------------------------------------------
    console.log('\n--- 6. UPSERTING EMPLOYEES (FIRST PASS) ---');
    const empIdByCode = {};

    for (const emp of workforce) {
      const deptId = deptMap[emp.dept_code];
      const desigId = desigMap[emp.desig_code];
      const empTypeId = empTypeMap[emp.emp_type];

      const res = await pool.query(`
        INSERT INTO employees (
          id, employee_code, first_name, middle_name, last_name,
          date_of_birth, gender, personal_email, work_email, phone,
          address, city, state, postal_code, branch_id, department_id,
          designation_id, employment_type_id, joining_date, employment_status,
          created_at, updated_at
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3, $4,
          $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT (employee_code) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          middle_name = EXCLUDED.middle_name,
          last_name = EXCLUDED.last_name,
          date_of_birth = EXCLUDED.date_of_birth,
          gender = EXCLUDED.gender,
          personal_email = EXCLUDED.personal_email,
          work_email = EXCLUDED.work_email,
          phone = EXCLUDED.phone,
          address = EXCLUDED.address,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          postal_code = EXCLUDED.postal_code,
          branch_id = EXCLUDED.branch_id,
          department_id = EXCLUDED.department_id,
          designation_id = EXCLUDED.designation_id,
          employment_type_id = EXCLUDED.employment_type_id,
          joining_date = EXCLUDED.joining_date,
          employment_status = EXCLUDED.employment_status,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, employee_code, first_name, last_name;
      `, [
        emp.code, emp.first_name, emp.middle_name, emp.last_name,
        emp.dob, emp.gender, emp.personal_email, emp.work_email, emp.phone,
        emp.address, emp.city, emp.state, emp.postal_code, branchId, deptId,
        desigId, empTypeId, emp.joining_date, emp.status
      ]);

      empIdByCode[emp.code] = res.rows[0].id;
      console.log(`✓ Upserted: [${emp.code}] ${emp.first_name} ${emp.last_name} (${res.rows[0].id})`);
    }

    // -----------------------------------------------------------------------
    // 7. SET REPORTING MANAGERS & DEPARTMENT HEADS (SECOND PASS)
    // -----------------------------------------------------------------------
    console.log('\n--- 7. UPDATING REPORTING MANAGERS & DEPARTMENT HEADS ---');
    for (const emp of workforce) {
      const empId = empIdByCode[emp.code];
      const managerId = emp.manager_code ? (empIdByCode[emp.manager_code] || null) : null;

      await pool.query(`
        UPDATE employees 
        SET reporting_manager_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2;
      `, [managerId, empId]);
    }
    console.log('✓ Successfully mapped reporting managers for all 22 employees.');

    // Update department heads
    await pool.query(`UPDATE departments SET head_id = $1 WHERE code = 'DEPT-ADMIN';`, [empIdByCode['STV-1001']]); // Principal
    await pool.query(`UPDATE departments SET head_id = $1 WHERE code = 'DEPT-SCI';`, [empIdByCode['EMP-1001']]);   // Eleanor Vance
    await pool.query(`UPDATE departments SET head_id = $1 WHERE code = 'DEPT-HUM';`, [empIdByCode['EMP-1002']]);   // Marcus Thorne
    await pool.query(`UPDATE departments SET head_id = $1 WHERE code = 'DEPT-PRI';`, [empIdByCode['STV-1012']]);   // Anjali More
    await pool.query(`UPDATE departments SET head_id = $1 WHERE code = 'DEPT-IT';`, [empIdByCode['STV-1018']]);    // Vivek Shah
    await pool.query(`UPDATE departments SET head_id = $1 WHERE code = 'DEPT-PE';`, [empIdByCode['EMP-1004']]);    // David Miller
    console.log('✓ Updated Department Heads for all 6 departments.');

    // -----------------------------------------------------------------------
    // 8. LINK USERS TABLE TO CORRESPONDING EMPLOYEE RECORDS
    // -----------------------------------------------------------------------
    console.log('\n--- 8. LINKING USERS TO EMPLOYEE RECORDS ---');
    await pool.query(`UPDATE users SET employee_id = $1 WHERE email = 'principal@school.edu';`, [empIdByCode['STV-1001']]);
    await pool.query(`UPDATE users SET employee_id = $1 WHERE email = 'admin@school.edu';`, [empIdByCode['STV-1002']]);
    await pool.query(`UPDATE users SET employee_id = $1 WHERE email = 'hr@school.edu';`, [empIdByCode['EMP-1003']]);
    await pool.query(`UPDATE users SET employee_id = $1 WHERE email = 'manager@school.edu';`, [empIdByCode['EMP-1002']]);
    await pool.query(`UPDATE users SET employee_id = $1 WHERE email = 'teacher@school.edu';`, [empIdByCode['EMP-1001']]);
    console.log('✓ Linked all 5 authentication demo accounts to verified employee profiles.');

    // -----------------------------------------------------------------------
    // 9. VERIFY WORKFORCE SUMMARY
    // -----------------------------------------------------------------------
    console.log('\n=== WORKFORCE SUMMARY BY DEPARTMENT ===');
    const summary = await pool.query(`
      SELECT d.name as department_name, d.code, 
             COUNT(e.id)::int as employee_count,
             h.first_name || ' ' || h.last_name as department_head
      FROM departments d
      LEFT JOIN employees e ON e.department_id = d.id
      LEFT JOIN employees h ON d.head_id = h.id
      GROUP BY d.id, d.name, d.code, h.first_name, h.last_name
      ORDER BY employee_count DESC, d.name ASC;
    `);
    console.table(summary.rows);

    console.log('\n=== COMPLETE EMPLOYEE ROSTER ===');
    const roster = await pool.query(`
      SELECT e.employee_code, 
             e.first_name || ' ' || COALESCE(e.last_name, '') as full_name,
             des.name as designation,
             d.name as department,
             et.name as emp_type,
             e.employment_status as status,
             TO_CHAR(e.joining_date, 'YYYY-MM-DD') as joined,
             m.first_name || ' ' || m.last_name as reports_to
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      LEFT JOIN employment_types et ON e.employment_type_id = et.id
      LEFT JOIN employees m ON e.reporting_manager_id = m.id
      ORDER BY e.employee_code;
    `);
    console.table(roster.rows);

    console.log('\n================================================================');
    console.log('✓ REALISTIC SCHOOL WORKFORCE SEEDING COMPLETED SUCCESSFULLY');
    console.log('================================================================');
  } catch (error) {
    console.error('Error seeding workforce:', error);
  } finally {
    await pool.end();
  }
}

seedRealisticWorkforce();
