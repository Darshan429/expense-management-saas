# Team Expense Management SaaS

A full-stack expense management application built for teams.

## Live Demo
🔗 https://expense-management-saas.vercel.app

### Demo Accounts
| Role     | Email              | Password   |
|----------|--------------------|------------|
| Admin    | admin@demo.com     | Demo@1234  |
| Manager  | manager@demo.com   | Demo@1234  |
| Employee | employee@demo.com  | Demo@1234  |

## Features
- JWT Authentication with refresh token rotation
- Role-based access control (Admin / Manager / Employee)
- AI-powered receipt scanning (OpenAI Vision API)
- Real-time approval notifications (Socket.io)
- Analytics dashboard with Recharts
- Budget management with 80%/100% threshold alerts
- CSV and PDF export
- Admin panel with audit log

## Tech Stack
| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | React, Vite, Recharts, Socket.io    |
| Backend   | Node.js, Express, Socket.io         |
| Database  | MySQL, Sequelize ORM                |
| Auth      | JWT, bcrypt, refresh token rotation |
| AI        | OpenAI Vision API                   |
| Deploy    | Vercel (frontend), Railway (backend)|

## Architecture
- DB-first notification pattern (offline users never miss alerts)
- budget_summary MySQL VIEW (always-fresh computed totals)
- Atomic approval transactions (status + audit record together)
- Token rotation (old refresh token revoked on every refresh)

## Local Setup
\`\`\`bash
# Backend
cd server && npm install
cp .env.example .env   # fill in your values
npm run dev

# Frontend
cd client && npm install
npm run dev
\`\`\`
