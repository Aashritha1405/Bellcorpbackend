// 

const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();

app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://bellcorpfrontend.vercel.app'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

app.use(express.json());

const PORT = process.env.PORT || 5000;

// Configs
const LIMITS = {
    Bike: 5,
    Car: 5,
    Truck: 2
};

// Test route
app.get('/', (req, res) => {
    res.send('Backend is working');
});

// Availability
app.get('/api/availability', (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT vehicle_type, count(*) as count
            FROM tickets
            WHERE status = 'PARKED'
            GROUP BY vehicle_type
        `).all();

        let counts = { Bike: 0, Car: 0, Truck: 0 };
        rows.forEach(row => {
            counts[row.vehicle_type] = row.count;
        });

        res.json({
            bikes: { limit: LIMITS.Bike, count: counts.Bike, available: LIMITS.Bike - counts.Bike },
            cars: { limit: LIMITS.Car, count: counts.Car, available: LIMITS.Car - counts.Car },
            trucks: { limit: LIMITS.Truck, count: counts.Truck, available: LIMITS.Truck - counts.Truck }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Park Vehicle
app.post('/api/park', (req, res) => {
    try {
        const { vehicle_number, vehicle_type } = req.body;

        if (!vehicle_number || !vehicle_type) {
            return res.status(400).json({ error: 'vehicle_number and vehicle_type are required' });
        }

        if (!LIMITS[vehicle_type]) {
            return res.status(400).json({ error: 'Invalid vehicle_type' });
        }

        const row = db.prepare(`
            SELECT count(*) as count
            FROM tickets
            WHERE status = 'PARKED' AND vehicle_type = ?
        `).get(vehicle_type);

        if (row.count >= LIMITS[vehicle_type]) {
            return res.status(400).json({ error: 'Parking Full for this vehicle type' });
        }

        const result = db.prepare(`
            INSERT INTO tickets (vehicle_number, vehicle_type, entry_time)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `).run(vehicle_number, vehicle_type);

        const ticket = db.prepare(`
            SELECT * FROM tickets WHERE id = ?
        `).get(result.lastInsertRowid);

        res.json({ message: 'Vehicle parked successfully', ticket });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Exit Vehicle
app.post('/api/exit', (req, res) => {
    try {
        const { ticket_id, vehicle_number } = req.body;

        let row;

        if (ticket_id) {
            row = db.prepare(`
                SELECT * FROM tickets
                WHERE status = 'PARKED' AND id = ?
            `).get(ticket_id);
        } else if (vehicle_number) {
            row = db.prepare(`
                SELECT * FROM tickets
                WHERE status = 'PARKED' AND vehicle_number = ?
            `).get(vehicle_number);
        } else {
            return res.status(400).json({ error: 'Please provide ticket_id or vehicle_number' });
        }

        if (!row) {
            return res.status(404).json({ error: 'Ticket/Vehicle not found or already exited' });
        }

        const entryTime = new Date(row.entry_time + 'Z'); // SQLite CURRENT_TIMESTAMP is UTC
        const exitTime = new Date();
        const durationMs = exitTime - entryTime;
        const durationHours = durationMs / (1000 * 60 * 60);

        let fee = 0;
        if (durationHours <= 3) {
            fee = 30;
        } else if (durationHours <= 6) {
            fee = 85;
        } else {
            fee = 120;
        }

        const formattedExitTime = exitTime.toISOString().replace('T', ' ').slice(0, 19);

        db.prepare(`
            UPDATE tickets
            SET status = 'EXITED', exit_time = ?, fee = ?
            WHERE id = ?
        `).run(formattedExitTime, fee, row.id);

        res.json({
            message: 'Vehicle exited successfully',
            ticket_id: row.id,
            vehicle_number: row.vehicle_number,
            entry_time: row.entry_time,
            exit_time: formattedExitTime,
            duration_hours: durationHours.toFixed(2),
            fee: fee
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Parked Vehicles
app.get('/api/parked', (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT * FROM tickets
            WHERE status = 'PARKED'
            ORDER BY entry_time DESC
        `).all();

        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
});