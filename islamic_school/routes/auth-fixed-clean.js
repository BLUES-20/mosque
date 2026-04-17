// routes/auth-fixed.js - FAST REGISTRATION (no image, no emails)
const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const https = require('https');
const router = express.Router();
const db = require('../config/db'); // Use PostgreSQL/Supabase
const multer = require('multer');
const path = require('path');
const { sendEmail, getEmailStatus } = require('../services/email');

// Helper function to verify Google reCAPTCHA v2
function verifyRecaptcha(token) {
    return new Promise((resolve) => {
        const secret = process.env.GOOGLE_RECAPTCHA_SECRET;
        if (!secret) return resolve(true);
        const postData = `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token || '')}`;
        const options = {
            hostname: 'www.google.com',
            port: 443,
            path: '/recaptcha/api/siteverify',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve(result.success === true);
                } catch (e) {
                    resolve(false);
                }
            });
        });
        req.on('error', () => resolve(false));
        req.write(postData);
        req.end();
    });
}

// Configure Multer for future use (profile pics)
const { studentStorage } = require('../config/cloudinary');
const uploadPicture = multer({
    storage: studentStorage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpg|jpeg|png/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) return cb(null, true);
        cb(new Error('Only JPG, JPEG and PNG images are allowed!'));
    }
});

// =================== STUDENT LOGIN ===================
router.get('/student-login', (req, res) => {
    res.render('auth/student-login', { title: 'Student Login - Islamic School', page: 'student-login' });
});

router.post('/student-login', async (req, res) => {
    const { admission_number, password } = req.body;
    if (!admission_number || !password) {
        req.flash('error', 'Please enter admission number and password');
        return res.redirect('/auth/student-login');
    }

    if (process.env.GOOGLE_RECAPTCHA_SECRET && process.env.GOOGLE_RECAPTCHA_SITE_KEY) {
        const recaptchaToken = req.body['g-recaptcha-response'];
        const isHuman = await verifyRecaptcha(recaptchaToken);
        if (!isHuman) {
            req.flash('error', 'Please complete the reCAPTCHA verification');
            return res.redirect('/auth/student-login');
        }
    }

    try {
        const { rows } = await db.query(`
            SELECT u.password, s.id, s.user_id, s.admission_number, s.first_name, s.last_name, s.email, s.class, s.picture
            FROM users u JOIN students s ON u.id = s.user_id
            WHERE s.admission_number = $1 AND u.role = 'student'`, [admission_number]);

        if (!rows.length) {
            req.flash('error', 'Invalid admission number or password');
            return res.redirect('/auth/student-login');
        }

        const student = rows[0];
        let match = student.password === password || await bcrypt.compare(password, student.password);

        if (!match) {
            req.flash('error', 'Invalid admission number or password');
            return res.redirect('/auth/student-login');
        }

        req.session.student = {
            id: student.id,
            user_id: student.user_id,
            name: `${student.first_name} ${student.last_name}`,
            admission_number: student.admission_number,
            email: student.email,
            class: student.class,
            picture: student.picture
        };

        req.flash('success', `Welcome back, ${student.first_name}!`);
        res.redirect('/student/dashboard');
    } catch (err) {
        console.error('Student login error:', err);
        req.flash('error', 'Login failed. Please try again.');
        res.redirect('/auth/student-login');
    }
});

// =================== STAFF LOGIN ===================
router.get('/staff-login', (req, res) => {
    res.render('auth/staff-login', { title: 'Staff Login - Islamic School', page: 'staff-login' });
});

router.post('/staff-login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        req.flash('error', 'Please enter email and password');
        return res.redirect('/auth/staff-login');
    }

    if (process.env.GOOGLE_RECAPTCHA_SECRET && process.env.GOOGLE_RECAPTCHA_SITE_KEY) {
        const recaptchaToken = req.body['g-recaptcha-response'];
        const isHuman = await verifyRecaptcha(recaptchaToken);
        if (!isHuman) {
            req.flash('error', 'Please complete the reCAPTCHA verification');
            return res.redirect('/auth/staff-login');
        }
    }

    try {
        const { rows } = await db.query(`
            SELECT u.id as user_id, u.password, u.role, u.email, s.id as staff_id, s.first_name, s.last_name, s.position
            FROM users u LEFT JOIN staff s ON u.id = s.user_id
            WHERE u.email = $1 AND u.role IN ('staff', 'admin')`, [email]);

        if (!rows.length) {
            req.flash('error', 'Invalid email or password');
            return res.redirect('/auth/staff-login');
        }

        const user = rows[0];
        let match = user.password === password || await bcrypt.compare(password, user.password);

        if (!match) {
            req.flash('error', 'Invalid email or password');
            return res.redirect('/auth/staff-login');
        }

        req.session.staff = {
            id: user.staff_id || user.user_id,
            user_id: user.user_id,
            name: user.first_name ? `${user.first_name} ${user.last_name}` : 'Administrator',
            email: user.email,
            position: user.position || 'Admin',
            role: user.role
        };

        req.flash('success', `Welcome back, ${req.session.staff.name}!`);
        res.redirect('/staff/dashboard');
    } catch (err) {
        console.error('Staff login error:', err);
        req.flash('error', 'Login failed. Please try again.');
        res.redirect('/auth/staff-login');
    }
});

// =================== STUDENT REGISTRATION (FAST - NO IMAGE, NO EMAILS) ===================
router.get('/student-register', (req, res) => {
    res.render('auth/student-register', {
        title: 'Student Registration - Islamic School',
        page: 'student-register'
    });
});

router.post('/student-register', async (req, res) => {
    console.log('\n📝 ========== STUDENT REGISTRATION START ==========');
    
    const first_name = (req.body?.first_name || '').trim();
    const last_name = (req.body?.last_name || '').trim();
    const email = (req.body?.email || '').trim().toLowerCase();
    const password = req.body?.password || '';
    const confirm_password = req.body?.confirm_password || '';
    const date_of_birth = req.body?.date_of_birth || null;
    const gender = req.body?.gender || null;
    const class_name = req.body?.class_name || null;
    const parent_name = (req.body?.parent_name || '').trim();
    const parent_phone = (req.body?.parent_phone || '').trim();
    const parent_email = (req.body?.parent_email || '').trim();
    const address = (req.body?.address || '').trim();

    console.log('📋 Received data:', { first_name, last_name, email, password: '***', class_name });

    // ===== VALIDATION =====
    if (!first_name) {
        console.warn('❌ Missing first_name');
        req.flash('error', 'First name is required');
        return res.redirect('/auth/student-register');
    }
    if (!last_name) {
        console.warn('❌ Missing last_name');
        req.flash('error', 'Last name is required');
        return res.redirect('/auth/student-register');
    }
    if (!email) {
        console.warn('❌ Missing email');
        req.flash('error', 'Email is required');
        return res.redirect('/auth/student-register');
    }
    if (!password) {
        console.warn('❌ Missing password');
        req.flash('error', 'Password is required');
        return res.redirect('/auth/student-register');
    }
    if (!confirm_password) {
        console.warn('❌ Missing confirm_password');
        req.flash('error', 'Please confirm password');
        return res.redirect('/auth/student-register');
    }
    if (password !== confirm_password) {
        console.warn('❌ Passwords do not match');
        req.flash('error', 'Passwords do not match');
        return res.redirect('/auth/student-register');
    }
    if (password.length < 6) {
        console.warn('❌ Password too short');
        req.flash('error', 'Password must be at least 6 characters');
        return res.redirect('/auth/student-register');
    }

    try {
        console.log('🔐 Starting registration process...');

        // Check email uniqueness
        console.log('🔍 Checking email uniqueness...');
        let checkResult = await db.query('SELECT id FROM users WHERE LOWER(email) = $1', [email.toLowerCase()]);
        if (checkResult.rows.length > 0) {
            console.warn('⚠️ Email already exists:', email);
            req.flash('error', 'Email already registered. Please use a different email.');
            return res.redirect('/auth/student-register');
        }
        console.log('✅ Email is unique');

        // Generate admission number - find the max and increment
        console.log('📊 Generating admission number...');
        const year = new Date().getFullYear();
        const prefix = `STU${year}`;
        
        // Get the highest admission number for this year
        let maxResult = await db.query(
            `SELECT admission_number FROM students 
             WHERE admission_number LIKE $1 
             ORDER BY admission_number DESC LIMIT 1`,
            [`${prefix}%`]
        );
        
        let admission_number = prefix + '001';
        if (maxResult.rows.length > 0) {
            const lastNum = maxResult.rows[0].admission_number;
            const numPart = parseInt(lastNum.substring(prefix.length));
            const nextNum = numPart + 1;
            admission_number = prefix + String(nextNum).padStart(3, '0');
        }
        
        console.log(`✅ Generated admission number: ${admission_number}`);

        // Hash password
        console.log('🔐 Hashing password...');
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log('✅ Password hashed');

        // Create user in database
        console.log('👤 Creating user in database...');
        let userResult = await db.query(
            `INSERT INTO users (username, email, password, role) 
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [email, email, hashedPassword, 'student']
        );
        const user_id = userResult.rows[0].id;
        console.log(`✅ User created with ID: ${user_id}`);

        // Create student record
        console.log('📚 Creating student record...');
        let studentResult = await db.query(
            `INSERT INTO students (
                user_id, admission_number, first_name, last_name, email,
                date_of_birth, gender, class, parent_name, parent_phone, parent_email, address, payment_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'paid') RETURNING id`,
            [
                user_id,
                admission_number,
                first_name,
                last_name,
                email,
                date_of_birth || null,
                gender || null,
                class_name || null,
                parent_name || null,
                parent_phone || null,
                parent_email || null,
                address || null
            ]
        );
        const student_id = studentResult.rows[0].id;
        console.log(`✅ Student created with ID: ${student_id}`);

        req.session.paymentSuccess = {
            student: {
                full_name: `${first_name} ${last_name}`,
                email,
                admission_number,
                class_name: class_name || 'Not specified'
            }
        };

        console.log('\n✅ ========== REGISTRATION SUCCESS ==========');
        console.log(`Student: ${first_name} ${last_name}`);
        console.log(`Email: ${email}`);
        console.log(`Admission: ${admission_number}`);
        console.log('=========================================\n');

        req.flash('success', `Registration successful! Your admission number is ${admission_number}.`);
        res.redirect('/auth/payment-success');

    } catch (err) {
        console.error('\n❌ ========== REGISTRATION ERROR ==========');
        console.error('Message:', err.message);
        console.error('Code:', err.code);
        console.error('Detail:', err.detail);
        console.error('Constraint:', err.constraint);
        console.error('=========================================\n');
        
        req.flash('error', 'Registration failed. Please try again.');
        res.redirect('/auth/student-register');
    }
});

// =================== REGISTRATION PAYMENT PAGE ===================
router.get('/registration-payment', (req, res) => {
    req.flash('success', 'Registration now completes immediately. No payment is required.');
    res.redirect('/auth/student-register');
});

// Flutterwave payment callback - SEND ADMISSION NUMBER AFTER PAYMENT SUCCESS
router.get('/payment-callback', async (req, res) => {
    req.flash('success', 'Registration is already complete. You can now log in.');
    return res.redirect('/auth/student-login');

    const { status, tx_ref, transaction_id } = req.query;
    let pending = req.session.pendingRegistration;

    console.log(`\n💳 ========== PAYMENT CALLBACK ==========`);
    console.log(`Status: ${status}`);
    console.log(`TX Ref: ${tx_ref}`);
    console.log(`Transaction ID: ${transaction_id}`);
    console.log(`Session pending: ${pending ? '✓' : '✗'}`);

    // If no session, try to find the student from tx_ref
    if (!pending && tx_ref) {
        try {
            // tx_ref format: REG-STU2026###-timestamp
            const admissionMatch = tx_ref.match(/STU\d+/);
            if (admissionMatch) {
                const admission_number = admissionMatch[0];
                console.log(`🔍 Looking up student by admission number: ${admission_number}`);
                
                const studentRes = await db.query(
                    'SELECT id, first_name, last_name, email, class FROM students WHERE admission_number = $1',
                    [admission_number]
                );
                
                if (studentRes.rows.length > 0) {
                    const student = studentRes.rows[0];
                    pending = {
                        student_id: student.id,
                        admission_number: admission_number,
                        full_name: `${student.first_name} ${student.last_name}`,
                        email: student.email,
                        class_name: student.class
                    };
                    console.log(`✅ Student found: ${pending.full_name}`);
                } else {
                    console.warn(`⚠️ Student not found with admission number: ${admission_number}`);
                }
            }
        } catch (lookupErr) {
            console.error('Error looking up student:', lookupErr);
        }
    }

    if (!pending) {
        console.error('❌ No pending registration or student found in session');
        req.flash('error', 'Session expired or student not found. Please contact admin.');
        return res.redirect('/auth/student-login');
    }

    if (status === 'successful') {
        try {
            console.log(`✅ Payment successful for student ${pending.student_id}`);
            
// Record payment & activate student
            const paymentRes = await db.query(
                `INSERT INTO payments (student_id, tx_ref, flw_transaction_id, amount, currency, payment_type, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (tx_ref) DO UPDATE SET status = $7
                 RETURNING id`,
                [pending.student_id, tx_ref, transaction_id, 2000, 'NGN', 'registration', 'successful']
            );
            console.log(`💾 Payment recorded:`, paymentRes.rows[0]);

            // ✅ Activate student account
            await db.query("UPDATE students SET payment_status = 'paid' WHERE id = $1", [pending.student_id]);
            console.log('✅ Student account activated (payment_status = paid)'); 

            // Store success data in session for the success page
            req.session.paymentSuccess = {
                student: {
                    full_name: pending.full_name,
                    email: pending.email,
                    admission_number: pending.admission_number,
                    class_name: pending.class_name
                },
            };

            delete req.session.pendingRegistration;
            
            console.log(`🎉 Redirecting to payment-success page`);
            res.redirect('/auth/payment-success');
        } catch (err) {
            console.error('❌ Payment callback error:', err);
            req.flash('error', 'Payment processing failed. Please contact admin.');
            delete req.session.pendingRegistration;
            res.redirect('/auth/student-login');
        }
    } else {
        console.warn(`⚠️ Payment status: ${status}`);
        req.flash('error', 'Payment was not successful. Please try again.');
        res.redirect('/auth/registration-payment');
    }
});

// =================== PAYMENT SUCCESS PAGE ===================
router.get('/payment-success', (req, res) => {
    const successData = req.session.paymentSuccess;
    
    if (!successData) {
        req.flash('error', 'Session expired. Please contact admin.');
        return res.redirect('/auth/student-login');
    }

    res.render('auth/payment-success', {
        title: 'Registration Successful - Islamic School',
        page: 'payment-success',
        student: successData.student
    });

    // Clear the success data after rendering
    delete req.session.paymentSuccess;
});

// ==================== RESEND ADMISSION EMAIL ====================
// Allows admin to manually resend admission email to student
router.post('/resend-admission', async (req, res) => {
    // Implementation removed to avoid sendEmail dependency
    res.json({ success: false, error: 'Resend feature temporarily disabled' });
});

// =================== FORGOT PASSWORD ===================
router.get('/forgot-password', (req, res) => {
    res.render('auth/forgot-password', {
        title: 'Forgot Password - Islamic School',
        page: 'forgot-password'
    });
});

router.post('/forgot-password', async (req, res) => {
    const email = (req.body?.email || '').trim().toLowerCase();

    if (!email) {
        req.flash('error', 'Please enter your email address.');
        return res.redirect('/auth/forgot-password');
    }

    try {
        const result = await db.query(
            'SELECT id, email FROM users WHERE LOWER(email) = $1 LIMIT 1',
            [email]
        );

        if (result.rows.length === 0) {
            req.flash('error', 'No account was found with that email address.');
            return res.redirect('/auth/forgot-password');
        }

        const emailStatus = getEmailStatus();
        if (!emailStatus.configured) {
            req.flash('error', 'Password reset email is not configured yet. Please contact admin.');
            return res.redirect('/auth/forgot-password');
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        await db.query(
            'UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE id = $3',
            [token, expiresAt, result.rows[0].id]
        );

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const resetUrl = `${baseUrl}/auth/reset-password/${token}`;
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a5f3f;">Reset Your Password</h2>
                <p>We received a request to reset your password.</p>
                <p>
                    <a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#1a5f3f;color:#fff;text-decoration:none;border-radius:6px;">
                        Reset Password
                    </a>
                </p>
                <p>This link will expire in 1 hour.</p>
                <p>If you did not request this, you can ignore this email.</p>
            </div>
        `;

        const sent = await sendEmail(result.rows[0].email, 'Reset Your Password - Islamic School', html);
        if (!sent) {
            req.flash('error', 'Unable to send reset email right now. Please contact admin.');
            return res.redirect('/auth/forgot-password');
        }

        req.flash('success', 'Password reset link sent successfully. Check your email.');
        res.redirect('/auth/forgot-password');
    } catch (err) {
        console.error('Forgot password error:', err);
        req.flash('error', 'Error sending password reset email. Please try again.');
        res.redirect('/auth/forgot-password');
    }
});

router.get('/reset-password/:token', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id FROM users WHERE reset_password_token = $1 AND reset_password_expires > $2',
            [req.params.token, new Date()]
        );

        if (!result.rows.length) {
            req.flash('error', 'Password reset token is invalid or has expired.');
            return res.redirect('/auth/forgot-password');
        }

        res.render('auth/reset-password', {
            title: 'Reset Password - Islamic School',
            page: 'reset-password',
            token: req.params.token,
            messages: {}
        });
    } catch (err) {
        console.error('Reset token check error:', err);
        req.flash('error', 'Unable to validate reset token.');
        res.redirect('/auth/forgot-password');
    }
});

router.post('/reset-password/:token', async (req, res) => {
    const password = req.body?.password || '';
    const confirmPassword = req.body?.confirm_password || '';

    if (password.length < 6) {
        req.flash('error', 'Password must be at least 6 characters.');
        return res.redirect('back');
    }

    if (password !== confirmPassword) {
        req.flash('error', 'Passwords do not match.');
        return res.redirect('back');
    }

    try {
        const result = await db.query(
            'SELECT id FROM users WHERE reset_password_token = $1 AND reset_password_expires > $2',
            [req.params.token, new Date()]
        );

        if (!result.rows.length) {
            req.flash('error', 'Password reset token is invalid or has expired.');
            return res.redirect('/auth/forgot-password');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query(
            'UPDATE users SET password = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2',
            [hashedPassword, result.rows[0].id]
        );

        req.flash('success', 'Your password has been changed successfully.');
        res.redirect('/auth/student-login');
    } catch (err) {
        console.error('Reset password error:', err);
        req.flash('error', 'Error resetting password. Please try again.');
        res.redirect('back');
    }
});

// Forgot password, reset, logout (unchanged)
router.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
