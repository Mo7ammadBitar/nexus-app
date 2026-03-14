# Nexus - Run Guide

A Discord-like voice & text chat application with a FastAPI backend and React frontend.

---

## Prerequisites

Make sure you have the following installed:

| Software | Version | Download |
|----------|---------|----------|
| **Python** | 3.11+ | [python.org](https://www.python.org/downloads/) |
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org/) |
| **MongoDB** | 6.0+ | [mongodb.com](https://www.mongodb.com/try/download/community) |

> [!IMPORTANT]
> MongoDB must be running before starting the backend. The default connection is `mongodb://localhost:27017`.

---

## Quick Start

### 1. Start MongoDB

Make sure MongoDB is running on your system:

```bash
# Windows (if installed as a service, it starts automatically)
# Otherwise, run:
mongod
```

---

### 2. Backend Setup

Open a terminal and navigate to the backend folder:

```bash
cd nexus_/backend
```

#### Create Virtual Environment (First Time Only)

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows PowerShell:
.\venv\Scripts\Activate.ps1

# Windows CMD:
venv\Scripts\activate.bat

# Linux/Mac:
source venv/bin/activate
```

#### Install Dependencies (First Time Only)

```bash
pip install -r requirements.txt
```

#### Run the Backend Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

> [!TIP]
> The backend will be available at: **http://localhost:8000**
> 
> API Documentation: **http://localhost:8000/docs**

---

### 3. Frontend Setup

Open a **new terminal** and navigate to the frontend folder:

```bash
cd nexus_/frontend
```

#### Install Dependencies (First Time Only)

```bash
npm install
```

#### Run the Frontend Development Server

```bash
npm start
```

> [!TIP]
> The frontend will be available at: **http://localhost:3000**

---

## Default Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | mohammadbisherbitar@gmail.com | mohammad2004 |

---

## Project Structure

```
nexus_/
├── backend/           # FastAPI Python backend
│   ├── app/           # Application code
│   ├── .env           # Environment variables
│   └── requirements.txt
├── frontend/          # React frontend
│   ├── src/           # Source code
│   ├── public/        # Static files
│   └── package.json
└── uploads/           # User uploaded files
```

---

## Common Issues & Solutions

### Backend won't start

1. **Virtual environment not activated**
   ```bash
   # Make sure you see (venv) in your terminal prompt
   .\venv\Scripts\Activate.ps1   # PowerShell
   ```

2. **MongoDB not running**
   ```bash
   # Start MongoDB service
   mongod
   ```

3. **Port 8000 already in use**
   ```bash
   # Use a different port
   uvicorn app.main:app --reload --port 8001
   ```

### Frontend won't start

1. **Dependencies not installed**
   ```bash
   npm install
   ```

2. **Port 3000 already in use**
   - Close other applications using port 3000
   - Or the dev server will automatically use port 3001

---

## Running in Production

### Backend
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Frontend
```bash
npm run build
# Serve the build folder with a static server
```

---

## Electron Desktop App (Optional)

To run as a desktop application:

```bash
cd frontend
npm run electron-dev
```

---

## Environment Variables

Backend environment variables are in `backend/.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URL` | MongoDB connection string | `mongodb://localhost:27017` |
| `DATABASE_NAME` | Database name | `nexus` |
| `SECRET_KEY` | JWT secret key | (change in production) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token expiry | `1440` (24 hours) |

---

Made with ❤️ by the Nexus Team
