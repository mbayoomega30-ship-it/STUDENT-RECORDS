# Student Registration System (Database2 / NoSQL)

Student registration website with an administrator dashboard. Student submissions are saved to MongoDB and can only be viewed or managed after administrator sign-in.

Stack: HTML/CSS/JavaScript + Node.js/Express + MongoDB (Mongoose)

## Run
1. Install Node.js and MongoDB (or use a free MongoDB Atlas cluster).
2. `npm install`
3. The local testing admin password defaults to `12345678`. In PowerShell, start the backend:

   ```powershell
   # Optional, if using MongoDB Atlas:
   # $env:MONGO_URI = "your-atlas-connection-string"
   npm start
   ```

   To override the default, set `$env:ADMIN_PASSWORD = "your-private-password"` before `npm start`. The default password is stored in source code and is not suitable for a publicly accessible deployment.

4. Open http://localhost:3000 to register a student.
5. Open http://localhost:3000/admin.html to sign in and review registrations.

The registration form includes programme, year-of-study, and gender dropdowns. Year and gender are optional. The admin dashboard supports create, read, update, and delete. The initial programme choices (including “Other”), year levels, and gender choices are defined in `frontend/index.html` and validated by the corresponding option lists in `backend/server.js`; update both files together to change the choices.

## API
| Method | Route | Operation |
|---|---|---|
| POST | /api/students | Public student registration |
| POST | /api/admin/login | Administrator sign-in |
| POST | /api/admin/logout | Administrator sign-out |
| GET | /api/admin/session | Check administrator session |
| POST | /api/admin/students | Add student (administrator only) |
| GET | /api/students?q= | List/search registrations (administrator only) |
| PUT | /api/students/:id | Update registration (administrator only) |
| DELETE | /api/students/:id | Delete registration (administrator only) |
