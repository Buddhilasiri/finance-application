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
    const timeFrame = req.query.timeFrame || 'month'; // Default to 'month'
    let dateFilter;
    let budgetMultiplier = 1; // Adjust the budgets for day/week

    const currentDate = new Date();
    if (timeFrame === 'day') {
        dateFilter = currentDate.toISOString().split('T')[0]; // Today's date
        const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
        budgetMultiplier = 1 / daysInMonth;
    } else if (timeFrame === 'week') {
        const startOfWeek = new Date(currentDate.setDate(currentDate.getDate() - currentDate.getDay()));
        dateFilter = startOfWeek.toISOString().split('T')[0];
        budgetMultiplier = 1 / 4;
    } else if (timeFrame === 'month') {
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        dateFilter = startOfMonth.toISOString().split('T')[0];
        budgetMultiplier = 1;
    }

    db.all(`SELECT * FROM expenses WHERE date >= ?`, [dateFilter], (err, expenseRows) => {
        if (err) {
            throw err;
        }

        db.all('SELECT * FROM budgets', [], (err, budgetRows) => {
            if (err) {
                throw err;
            }

            // Adjust the budgets for day/week
            const adjustedBudgets = budgetRows.map(budget => ({
                ...budget,
                budget_amount: budget.budget_amount * budgetMultiplier
            }));

            // Render both expenses and budgets
            res.render('index', { expenses: expenseRows, budgets: adjustedBudgets, timeFrame });
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
// Route to reset all expenses
app.post('/reset-expenses', (req, res) => {
    db.run('DELETE FROM expenses', (err) => {
        if (err) {
            throw err;
        }
        res.redirect('/');
    });
});
// Route to delete an expense
app.post('/delete-expense', (req, res) => {
    const { id } = req.body; // Get the expense ID
    db.run('DELETE FROM expenses WHERE id = ?', [id], (err) => {
        if (err) {
            throw err;
        }
        res.redirect('/');
    });
});
// Route to delete a budget
app.post('/delete-budget', (req, res) => {
    const { category } = req.body;  // Extract the category from the form

    db.run('DELETE FROM budgets WHERE category = ?', [category], (err) => {
        if (err) {
            throw err;
        }
        res.redirect('/budgets');  // Redirect to the budgets page after deletion
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
