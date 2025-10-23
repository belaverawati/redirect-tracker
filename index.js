import express from "express";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// === Database Setup ===
const db = await open({
  filename: "./database.sqlite",
  driver: sqlite3.Database
});
await db.exec(`
  CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT,
    ip TEXT,
    user_agent TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// === Route untuk tracking + redirect ===
app.get("/go", async (req, res) => {
  const target = "https://jacksonsfamilyfarm.com/"; // Ganti ke URL targetmu
  const telegram_id = req.query.tg || null;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const ua = req.headers["user-agent"] || "-";

  await db.run(
    "INSERT INTO visits (telegram_id, ip, user_agent) VALUES (?, ?, ?)",
    [telegram_id, ip, ua]
  );

  res.redirect(target);
});

// === API untuk statistik ===
app.get("/stats", async (req, res) => {
  const total = await db.get("SELECT COUNT(*) as total FROM visits");
  const today = await db.get(
    "SELECT COUNT(*) as total FROM visits WHERE date(timestamp)=date('now')"
  );
  res.json({ total: total.total, today: today.total });
});

// === API untuk list visitor ===
app.get("/visitors", async (req, res) => {
  const rows = await db.all(
    "SELECT telegram_id, ip, user_agent, timestamp FROM visits ORDER BY id DESC LIMIT 100"
  );
  res.json(rows);
});

// === Dashboard sederhana ===
app.get("/", (req, res) => {
  res.send(`
    <h1>📊 Tracking Dashboard</h1>
    <div id="stats" style="font-size:18px;margin-bottom:10px;"></div>
    <table border="1" cellspacing="0" cellpadding="6" style="margin-top:10px;border-collapse:collapse;font-family:Arial;">
      <thead style="background:#f4f4f4;">
        <tr>
          <th>ID Telegram</th>
          <th>IP</th>
          <th>Device</th>
          <th>Waktu</th>
        </tr>
      </thead>
      <tbody id="table"></tbody>
    </table>
    <script>
      async function load() {
        const s = await fetch('/stats').then(r=>r.json());
        document.getElementById('stats').innerHTML =
          "👁️ Total: " + s.total + "<br>📅 Hari ini: " + s.today;

        const v = await fetch('/visitors').then(r=>r.json());
        let rows = "";
        v.forEach(r => {
          rows += "<tr>" +
                    "<td>" + (r.telegram_id || '-') + "</td>" +
                    "<td>" + (r.ip || '-') + "</td>" +
                    "<td>" + (r.user_agent || '-') + "</td>" +
                    "<td>" + r.timestamp + "</td>" +
                  "</tr>";
        });
        document.getElementById('table').innerHTML = rows;
      }
      load();
      setInterval(load, 5000);
    </script>
  `);
});

// === Start Server ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Redirect Tracker running on port ${PORT}`));
