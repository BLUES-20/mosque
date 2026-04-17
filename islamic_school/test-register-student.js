require('dotenv').config();
const { createStudentByAdmin } = require('./services/admin-student-register');
const db = require('./config/db');

(async () => {
  try {
    const email = 'test.student+' + Date.now() + '@example.com';
    const result = await createStudentByAdmin({
      first_name: 'Test',
      last_name: 'Student',
      email,
      password: 'Password123',
      class_name: 'Grade 5',
      date_of_birth: '2012-01-01',
      gender: 'male',
      parent_name: 'Parent Test',
      parent_phone: '08012345678',
      address: 'Test Address'
    });

    console.log('REGISTRATION RESULT:', result);

    if (result.success) {
      const student = await db.query(
        'SELECT u.id AS user_id, u.email, s.admission_number, s.first_name, s.last_name, s.parent_name, s.address, s.parent_phone, s.date_of_birth, s.gender, s.picture, s."class" AS class_name FROM users u JOIN students s ON u.id = s.user_id WHERE u.email = $1',
        [email]
      );
      console.log('REGISTERED STUDENT ROW:');
      console.dir(student.rows, { depth: null });
    }
  } catch (err) {
    console.error('SCRIPT ERROR:', err);
  } finally {
    process.exit();
  }
})();