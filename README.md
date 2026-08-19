# flow HCM

Employee Self-Service dashboard (React + Node.js + MongoDB) with Google login, check-in/check-out, leave requests, and attendance graphs from punch logs.

## Run

```
npm run install:all
npm run seed
npm run dev
```

Pehli dafa backend MongoDB binary download karega (~600MB). Uske baad data `backend/data/mongo` mein save hota hai.

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

Google credentials ke bina **Continue as Muzamil Javed (112)** se dashboard khul jata hai.

## Google Login

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) se OAuth 2.0 Client ID banayein (Web application)
2. Authorized JavaScript origin: `http://localhost:5173`
3. Authorized redirect URI: `http://localhost:5000/api/auth/google/callback`
4. `backend/.env` mein `GOOGLE_CLIENT_ID` aur `GOOGLE_CLIENT_SECRET` paste karein
5. Backend restart karein

Agar aapke paas MongoDB Server already installed hai to `backend/.env` mein `USE_EMBEDDED_MONGO=false` set karein.

`npm run seed` attendance logs (`backend/data/att-logs.txt`) MongoDB mein import karta hai. Punch type `1` = Check In, `0` = Check Out.

## Features

- Login with Google (OAuth 2.0)
- Dashboard charts from real punch logs
- Check In / Check Out (saved in MongoDB)
- Leave apply (Casual / Annual / Sick) with balances
- Attendance punch log table
