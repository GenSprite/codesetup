// server.js - Canteen POS Backend with Debug Logging
process.on('uncaughtException', (error) => {
    console.error('❌ UNCAUGHT EXCEPTION:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ UNHANDLED REJECTION:', error);
});

console.log('🔍 Server script is starting...');

console.log('📦 Loading express...');
const express = require('express');
console.log('✅ Express loaded');

console.log('📦 Loading mysql2...');
const mysql = require('mysql2/promise');
console.log('✅ MySQL2 loaded');

console.log('📦 Loading cors...');
const cors = require('cors');
console.log('✅ CORS loaded');

console.log('📦 Loading path...');
const path = require('path');
console.log('✅ Path loaded');

console.log('🚀 Creating express app...');
const app = express();
const PORT = 3000;
console.log('✅ App created');

console.log('⚙️ Setting up middleware...');
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
console.log('✅ Middleware configured');

console.log('🔌 Creating database pool...');
const pool = mysql.createPool({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'canteen_pos',
   
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
console.log('✅ Database pool created');

// Test database connection
console.log('🧪 Testing database connection...');
pool.getConnection()
    .then(connection => {
        console.log('✅ Database connected successfully');
        connection.release();
    })
    .catch(err => {
        console.error('❌ Database connection failed:', err.message);
        console.error('Please check:');
        console.error('1. MySQL is running in XAMPP');
        console.error('2. Database "canteen_pos" exists');
        console.error('3. Username and password are correct');
    });

console.log('🔧 Setting up routes...');

// ==================== AUTHENTICATION ====================

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const [users] = await pool.query(
            'SELECT id, username, full_name, role FROM users WHERE username = ? AND password = ? AND is_active = TRUE',
            [username, password]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        res.json({ success: true, user: users[0] });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== PRODUCTS ====================

app.get('/api/products', async (req, res) => {
    try {
        const [products] = await pool.query(
            'SELECT * FROM products WHERE is_active = TRUE ORDER BY category, name'
        );
        res.json({ success: true, products });
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/products/:id', async (req, res) => {
    try {
        const [products] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
        if (products.length === 0) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        res.json({ success: true, product: products[0] });
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/products', async (req, res) => {
    try {
        const { name, category, price, cost, stock_quantity, reorder_level, expiry_date } = req.body;
        const [result] = await pool.query(
            'INSERT INTO products (name, category, price, cost, stock_quantity, reorder_level, expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, category, price, cost, stock_quantity, reorder_level, expiry_date]
        );
        res.json({ success: true, productId: result.insertId });
    } catch (error) {
        console.error('Add product error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        const { name, category, price, cost, stock_quantity, reorder_level, expiry_date } = req.body;
        await pool.query(
            'UPDATE products SET name=?, category=?, price=?, cost=?, stock_quantity=?, reorder_level=?, expiry_date=? WHERE id=?',
            [name, category, price, cost, stock_quantity, reorder_level, expiry_date, req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        await pool.query('UPDATE products SET is_active = FALSE WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== SALES ====================

app.post('/api/sales', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        const { user_id, items, payment_method, amount_paid } = req.body;
        const total_amount = items.reduce((sum, item) => sum + item.subtotal, 0);
        const change_amount = amount_paid - total_amount;
        
        const [saleResult] = await connection.query(
            'INSERT INTO sales (user_id, total_amount, payment_method, amount_paid, change_amount) VALUES (?, ?, ?, ?, ?)',
            [user_id, total_amount, payment_method, amount_paid, change_amount]
        );
        
        const sale_id = saleResult.insertId;
        
        for (const item of items) {
            await connection.query(
                'INSERT INTO sale_items (sale_id, product_id, product_name, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
                [sale_id, item.product_id, item.product_name, item.quantity, item.price, item.subtotal]
            );
            
            const [products] = await connection.query('SELECT stock_quantity FROM products WHERE id = ?', [item.product_id]);
            const quantity_before = products[0].stock_quantity;
            const quantity_after = quantity_before - item.quantity;
            
            await connection.query(
                'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
                [item.quantity, item.product_id]
            );
            
            await connection.query(
                'INSERT INTO inventory_logs (product_id, action_type, quantity_changed, quantity_before, quantity_after, user_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [item.product_id, 'sale', -item.quantity, quantity_before, quantity_after, user_id, `Sale #${sale_id}`]
            );
        }
        
        await connection.commit();
        res.json({ success: true, sale_id, change_amount });
    } catch (error) {
        await connection.rollback();
        console.error('Create sale error:', error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
});

app.get('/api/sales', async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        let query = `
            SELECT s.*, u.full_name as cashier_name 
            FROM sales s 
            JOIN users u ON s.user_id = u.id 
            WHERE 1=1
        `;
        const params = [];
        
        if (start_date) {
            query += ' AND DATE(s.transaction_date) >= ?';
            params.push(start_date);
        }
        if (end_date) {
            query += ' AND DATE(s.transaction_date) <= ?';
            params.push(end_date);
        }
        
        query += ' ORDER BY s.transaction_date DESC';
        
        const [sales] = await pool.query(query, params);
        res.json({ success: true, sales });
    } catch (error) {
        console.error('Get sales error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/sales/:id', async (req, res) => {
    try {
        const [sales] = await pool.query(
            'SELECT s.*, u.full_name as cashier_name FROM sales s JOIN users u ON s.user_id = u.id WHERE s.id = ?',
            [req.params.id]
        );
        
        if (sales.length === 0) {
            return res.status(404).json({ success: false, message: 'Sale not found' });
        }
        
        const [items] = await pool.query('SELECT * FROM sale_items WHERE sale_id = ?', [req.params.id]);
        
        res.json({ success: true, sale: sales[0], items });
    } catch (error) {
        console.error('Get sale details error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== DASHBOARD ====================

app.get('/api/dashboard', async (req, res) => {
    try {
        const [todaySales] = await pool.query(
            'SELECT COALESCE(SUM(total_amount), 0) as total FROM sales WHERE DATE(transaction_date) = CURDATE()'
        );
        
        const [todayTransactions] = await pool.query(
            'SELECT COUNT(*) as count FROM sales WHERE DATE(transaction_date) = CURDATE()'
        );
        
        const [lowStock] = await pool.query(
            'SELECT * FROM products WHERE stock_quantity <= 5 AND is_active = TRUE'
        );
        
        const [expiringSoon] = await pool.query(
            'SELECT * FROM products WHERE expiry_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND expiry_date >= CURDATE() AND is_active = TRUE'
        );
        
        const [expired] = await pool.query(
            'SELECT * FROM products WHERE expiry_date < CURDATE() AND is_active = TRUE'
        );
        
        const [bestSelling] = await pool.query(`
            SELECT si.product_name, SUM(si.quantity) as total_sold, SUM(si.subtotal) as total_revenue
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            WHERE s.transaction_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY si.product_id, si.product_name
            ORDER BY total_sold DESC
            LIMIT 5
        `);
        
        res.json({
            success: true,
            todaySales: todaySales[0].total,
            todayTransactions: todayTransactions[0].count,
            lowStock,
            expiringSoon,
            expired,
            bestSelling
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== REPORTS ====================

app.get('/api/reports/sales', async (req, res) => {
    try {
        const { start_date, end_date, group_by } = req.query;
        
        let dateGroup = 'DATE(transaction_date)';
        if (group_by === 'week') dateGroup = 'YEARWEEK(transaction_date)';
        if (group_by === 'month') dateGroup = 'DATE_FORMAT(transaction_date, "%Y-%m")';
        
        const [report] = await pool.query(`
            SELECT 
                ${dateGroup} as period,
                COUNT(*) as total_transactions,
                SUM(total_amount) as total_sales,
                AVG(total_amount) as avg_sale
            FROM sales
            WHERE DATE(transaction_date) BETWEEN ? AND ?
            GROUP BY period
            ORDER BY period
        `, [start_date, end_date]);
        
        res.json({ success: true, report });
    } catch (error) {
        console.error('Reports error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== INVENTORY ====================

app.post('/api/inventory/adjust', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        const { product_id, quantity_change, user_id, notes } = req.body;
        
        const [products] = await connection.query('SELECT stock_quantity FROM products WHERE id = ?', [product_id]);
        const quantity_before = products[0].stock_quantity;
        const quantity_after = quantity_before + quantity_change;
        
        await connection.query('UPDATE products SET stock_quantity = ? WHERE id = ?', [quantity_after, product_id]);
        
        await connection.query(
            'INSERT INTO inventory_logs (product_id, action_type, quantity_changed, quantity_before, quantity_after, user_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [product_id, 'adjustment', quantity_change, quantity_before, quantity_after, user_id, notes]
        );
        
        await connection.commit();
        res.json({ success: true });
    } catch (error) {
        await connection.rollback();
        console.error('Inventory adjust error:', error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
});

app.get('/api/inventory/logs', async (req, res) => {
    try {
        const [logs] = await pool.query(`
            SELECT il.*, p.name as product_name, u.full_name as user_name
            FROM inventory_logs il
            JOIN products p ON il.product_id = p.id
            JOIN users u ON il.user_id = u.id
            ORDER BY il.created_at DESC
            LIMIT 100
        `);
        res.json({ success: true, logs });
    } catch (error) {
        console.error('Inventory logs error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

console.log('✅ All routes configured');

// Start server
console.log('🚀 Starting server on port', PORT, '...');
app.listen(PORT, '0.0.0.0', () => {
    console.log('═══════════════════════════════════════════════════');
    console.log('✅ Canteen POS Server Started Successfully!');
    console.log('═══════════════════════════════════════════════════');
    console.log(`📍 Local Access:     http://localhost:${PORT}`);
    console.log(`📡 Network Access:   http://[YOUR_IP]:${PORT}`);
    console.log('');
    console.log('👤 Default Login Credentials:');
    console.log('   Owner:    username="owner"    password="password123"');
    console.log('   Manager:  username="manager"  password="password123"');
    console.log('   Cashier:  username="cashier1" password="password123"');
    console.log('═══════════════════════════════════════════════════');
});
