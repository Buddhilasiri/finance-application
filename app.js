const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const port = 4000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Set up view engine (EJS)
app.set('view engine', 'ejs');

// Connect to SQLite database
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        // Create table for expenses if it doesn't exist
        db.run(`
            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                expense_category TEXT,
                description TEXT,
                amount REAL,
                date TEXT
            )
        `);

        // Create table for budgets if it doesn't exist
        db.run(`
            CREATE TABLE IF NOT EXISTS budgets (
                category TEXT PRIMARY KEY,
                budget_amount REAL
            )
        `);
    }
});

// Home route (render the table layout)
app.get('/', (req, res) => {
    // Fetch both expenses and budgets
    db.all('SELECT * FROM expenses WHERE expense_category != "Savings"', [], (err, expenseRows) => {
        if (err) {
            throw err;
        }

        db.all('SELECT * FROM budgets', [], (err, budgetRows) => {
            if (err) {
                throw err;
            }

            // Render both expenses and budgets
            res.render('index', { expenses: expenseRows, budgets: budgetRows });
        });
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

// Route to render the budget page (form to set budgets)
app.get('/budgets', (req, res) => {
    db.all('SELECT * FROM budgets', [], (err, rows) => {
        if (err) {
            throw err;
        }
        res.render('budgets', { budgets: rows });
    });
});

// Route to handle form submission for setting/updating budgets
app.post('/set-budget', (req, res) => {
    const { category, budget_amount } = req.body;

    db.run(`
        INSERT INTO budgets (category, budget_amount)
        VALUES (?, ?)
        ON CONFLICT(category) DO UPDATE SET budget_amount=excluded.budget_amount
    `, [category, budget_amount], (err) => {
        if (err) {
            throw err;
        }
        res.redirect('/budgets');
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
