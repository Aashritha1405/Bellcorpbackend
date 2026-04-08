const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
//app.use(cors());
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5173', 'https://bellcorpfrontend.vercel.app'],
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

// Endpoints
app.get('/api/availability', (req, res) => {
    db.all(`SELECT vehicle_type, count(*) as count FROM tickets WHERE status = 'PARKED' GROUP BY vehicle_type`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        let counts = { Bike: 0, Car: 0, Truck: 0 };
        rows.forEach(row => {
            counts[row.vehicle_type] = row.count;
        });

        res.json({
            bikes: { limit: LIMITS.Bike, count: counts.Bike, available: LIMITS.Bike - counts.Bike },
            cars: { limit: LIMITS.Car, count: counts.Car, available: LIMITS.Car - counts.Car },
            trucks: { limit: LIMITS.Truck, count: counts.Truck, available: LIMITS.Truck - counts.Truck }
        });
    });
});

app.post('/api/park', (req, res) => {
    const { vehicle_number, vehicle_type } = req.body;
    if (!vehicle_number || !vehicle_type) {
        return res.status(400).json({ error: 'vehicle_number and vehicle_type are required' });
    }
    if (!LIMITS[vehicle_type]) {
        return res.status(400).json({ error: 'Invalid vehicle_type' });
    }

    db.get(`SELECT count(*) as count FROM tickets WHERE status = 'PARKED' AND vehicle_type = ?`, [vehicle_type], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (row.count >= LIMITS[vehicle_type]) {
            return res.status(400).json({ error: 'Parking Full for this vehicle type' });
        }

        db.run(`INSERT INTO tickets (vehicle_number, vehicle_type, entry_time) VALUES (?, ?, CURRENT_TIMESTAMP)`, [vehicle_number, vehicle_type], function (err) {
            if (err) return res.status(500).json({ error: err.message });

            db.get(`SELECT * FROM tickets WHERE id = ?`, [this.lastID], (err, row) => {
                res.json({ message: 'Vehicle parked successfully', ticket: row });
            });
        });
    });
});

app.post('/api/exit', (req, res) => {
    const { ticket_id, vehicle_number } = req.body;

    let query = `SELECT * FROM tickets WHERE status = 'PARKED' AND `;
    let param = [];
    if (ticket_id) {
        query += `id = ?`;
        param.push(ticket_id);
    } else if (vehicle_number) {
        query += `vehicle_number = ?`;
        param.push(vehicle_number);
    } else {
        return res.status(400).json({ error: 'Please provide ticket_id or vehicle_number' });
    }

    db.get(query, param, (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Ticket/Vehicle not found or already exited' });

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

        db.run(`UPDATE tickets SET status = 'EXITED', exit_time = ?, fee = ? WHERE id = ?`, [formattedExitTime, fee, row.id], function (err) {
            if (err) return res.status(500).json({ error: err.message });

            res.json({
                message: 'Vehicle exited successfully',
                ticket_id: row.id,
                vehicle_number: row.vehicle_number,
                entry_time: row.entry_time,
                exit_time: formattedExitTime,
                duration_hours: durationHours.toFixed(2),
                fee: fee
            });
        });
    });
});

app.get('/api/parked', (req, res) => {
    db.all(`SELECT * FROM tickets WHERE status = 'PARKED' ORDER BY entry_time DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
