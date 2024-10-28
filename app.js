const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { parse } = require('json2csv');
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
        // Create tables if they don't exist
        db.run(`
            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                expense_category TEXT,
                description TEXT,
                amount REAL,
                date TEXT
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS budgets (
                category TEXT PRIMARY KEY,
                budget_amount REAL
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS income (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT,
                amount REAL,
                date TEXT
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

    // Query expenses and income
    db.all(`SELECT * FROM expenses WHERE date >= ?`, [dateFilter], (err, expenseRows) => {
        if (err) {
            throw err;
        }

        db.all('SELECT * FROM budgets', [], (err, budgetRows) => {
            if (err) {
                throw err;
            }

            db.all(`SELECT * FROM income WHERE date >= ?`, [dateFilter], (err, incomeRows) => {
                if (err) {
                    throw err;
                }

                // Calculate totals
                const totalExpenses = expenseRows.reduce((sum, expense) => sum + expense.amount, 0);
                const totalIncome = incomeRows.reduce((sum, income) => sum + income.amount, 0);
                const totalRemaining = totalIncome - totalExpenses;

                // Adjust the budgets for day/week
                const adjustedBudgets = budgetRows.map(budget => ({
                    ...budget,
                    budget_amount: budget.budget_amount * budgetMultiplier
                }));

                // Render both expenses, budgets, income, and totals
                res.render('index', { 
                    expenses: expenseRows, 
                    budgets: adjustedBudgets, 
                    timeFrame, 
                    totalExpenses, 
                    totalIncome, 
                    totalRemaining 
                });
            });
        });
    });
});

// Route to render the playground
app.get('/playground', (req, res) => {
    res.render('playground');
});

// Add a new expense
app.post('/add-expense', (req, res) => {
    const { expense_category, description, amount } = req.body;
    const date = new Date().toISOString().split('T')[0];

    db.run('INSERT INTO expenses (expense_category, description, amount, date) VALUES (?, ?, ?, ?)',
        [expense_category, description, amount, date], (err) => {
            if (err) throw err;
            res.redirect('/');
        });
});

// Add new income
app.post('/add-income', (req, res) => {
    const { source, amount } = req.body;
    const date = new Date().toISOString().split('T')[0];
    
    db.run('INSERT INTO income (source, amount, date) VALUES (?, ?, ?)', [source, amount, date], (err) => {
        if (err) throw err;
        res.redirect('/');
    });
});

// Route to render the budget page
app.get('/budgets', (req, res) => {
    db.all('SELECT * FROM budgets', [], (err, rows) => {
        if (err) throw err;
        
        const totalBudget = rows.reduce((sum, budget) => sum + (budget.budget_amount || 0), 0);
        res.render('budgets', { budgets: rows, totalBudget });
    });
});

// Set or update a budget
app.post('/set-budget', (req, res) => {
    const { category, budget_amount } = req.body;

    db.run(`INSERT INTO budgets (category, budget_amount)
            VALUES (?, ?)
            ON CONFLICT(category) DO UPDATE SET budget_amount=excluded.budget_amount`,
        [category, budget_amount], (err) => {
            if (err) throw err;
            res.redirect('/budgets');
        });
});

// Route to export expenses as CSV and clear them
app.post('/export-and-reset-expenses', (req, res) => {
    db.all('SELECT * FROM expenses', [], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Error exporting data.");
        }

        if (rows.length > 0) {
            const csvData = parse(rows, { fields: ['id', 'expense_category', 'description', 'amount', 'date'] });

            fs.writeFile('./exported_expenses.csv', csvData, (err) => {
                if (err) {
                    console.error('Error writing CSV file', err);
                    return res.status(500).send("Error exporting data.");
                }

                db.run('DELETE FROM expenses', (err) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).send("Error clearing expenses.");
                    }
                    res.redirect('/');
                });
            });
        } else {
            res.redirect('/');
        }
    });
});
// Delete an expense
app.post('/delete-expense', (req, res) => {
    const { id } = req.body;
    db.run('DELETE FROM expenses WHERE id = ?', [id], (err) => {
        if (err) throw err;
        res.redirect('/');
    });
});

// Delete a budget
app.post('/delete-budget', (req, res) => {
    const { category } = req.body;

    db.run('DELETE FROM budgets WHERE category = ?', [category], (err) => {
        if (err) throw err;
        res.redirect('/budgets');
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
