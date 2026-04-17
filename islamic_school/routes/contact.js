const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Use PostgreSQL/Supabase

// GET Contact Page
router.get('/contact', (req, res) => {
    res.render('public/contact', {
        title: 'Contact Us - Islamic School',
        page: 'contact'
    });
});

// POST Contact Form - Save to DB and Send Email
router.post('/contact', async (req, res) => {
    const {
        name,
        email,
        subject,
        message
    } = req.body;

    if (!name || !email || !subject || !message) {
        req.flash('error', 'All fields are required');
        return res.redirect('/contact');
    }

    try {
        // Save message to database
        await db.query(
            `INSERT INTO contact_messages (name, email, subject, message, status) VALUES ($1, $2, $3, $4, 'unread')`,
            [name, email, subject, message]
        );

        req.flash('success', 'Message received successfully! We will get back to you soon.');
        res.redirect('/contact');

    } catch (err) {
        console.error('Contact form error:', err);
        req.flash('error', 'Error sending message. Please try again later.');
        res.redirect('/contact');
    }
});

module.exports = router;
