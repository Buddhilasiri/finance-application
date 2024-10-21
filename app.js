const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const port = 4000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Set up view engine (EJS or plain HTML)
app.set('view engine', 'ejs');

// Connect to SQLite database
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        db.run(`
            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                expense_category TEXT,
                description TEXT,
                amount REAL,
                date TEXT
            )
        `);
    }
});

// Home route (render the table layout)
app.get('/', (req, res) => {
    db.all('SELECT * FROM expenses', [], (err, rows) => {
        if (err) {
            throw err;
        }
        res.render('index', { expenses: rows });
    });
});

// Add a new expense (handling form submission)
app.post('/add-expense', (req, res) => {
    const { expense_category, description, amount } = req.body;
    const date = new Date().toISOString().split('T')[0]; // Current date

    db.run(
        'INSERT INTO expenses (expense_category, description, amount, date) VALUES (?, ?, ?, ?)',
        [expense_category, description, amount, date],
        (err) => {
            if (err) {
                throw err;
            }
            res.redirect('/');
        }
    );
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
