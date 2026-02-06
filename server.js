const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true
}));
app.use(express.static(path.join(__dirname, 'public')));

// Email transporter setup (Gmail for production)
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'pavanjithpjfkings@gmail.com',  // Replace with your Gmail address
        pass: 'kfay gqlg lcyl opjh'      // Replace with your Gmail app password
    }
});

// Database setup
const db = new sqlite3.Database('doctorappointment.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the SQLite database.');
});

// Create users table
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
)`);

// Create appointments table
db.run(`CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    doctor TEXT NOT NULL,
    timing TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
)`);

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run(`INSERT INTO users (name, email, password) VALUES (?, ?, ?)`, [name, email, hashedPassword], function(err) {
        if (err) {
            return res.status(500).send('Error registering user');
        }
        res.redirect('/login');
    });
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err) {
            return res.status(500).send('Error logging in');
        }
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).send('Invalid email or password');
        }
        req.session.userId = user.id;
        res.redirect('/dashboard');
    });
});

app.get('/dashboard', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.post('/book-appointment', async (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    const { doctor, timing } = req.body;
    db.run(`INSERT INTO appointments (user_id, doctor, timing) VALUES (?, ?, ?)`, [req.session.userId, doctor, timing], function(err) {
        if (err) {
            return res.status(500).send('Error booking appointment');
        }
        // Get user email
        db.get(`SELECT email FROM users WHERE id = ?`, [req.session.userId], (err, user) => {
            if (err) {
                console.error('Error fetching user email:', err);
                return res.redirect('/confirmation');
            }
            // Send confirmation email
            const mailOptions = {
                from: 'noreply@doctorappointment.com',
                to: user.email,
                subject: 'Appointment Confirmation',
                text: `Your appointment has been booked with Dr. ${doctor} at ${timing}. Thank you!`
            };
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('Error sending email:', error);
                } else {
                    console.log('Email sent:', info.response);
                }
            });
        });
        res.redirect('/confirmation');
    });
});

app.get('/confirmation', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'public', 'confirmation.html'));
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
