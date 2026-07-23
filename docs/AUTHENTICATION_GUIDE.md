# 🔐 Authentication System Guide

This guide explains the complete authentication system I've built for your DuoCards project using Prisma, bcryptjs, and Next.js API routes.

## 📁 File Structure

```
src/
├── app/
│   ├── api/
│   │   └── auth/
│   │       ├── login/route.ts      # Login API endpoint
│   │       └── register/route.ts   # Registration API endpoint
│   └── page.tsx                    # Frontend login/register form
├── lib/
│   ├── auth.ts                     # Password hashing utilities
│   └── prisma.ts                   # Prisma client configuration
└── prisma/
    └── schema.prisma               # Database schema
```

## 🔧 How It Works

### 1. **Password Hashing (`src/lib/auth.ts`)**

```typescript
// Hash password before storing
const hashedPassword = await hashPassword("mypassword123");
// Result: "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J7..."

// Verify password during login
const isValid = await comparePassword("mypassword123", storedHash);
// Result: true or false
```

**Why bcrypt?**

- **Industry standard** for password hashing
- **Salt included** - each password gets a unique salt
- **Configurable rounds** - can increase security over time
- **Timing attack resistant** - takes same time regardless of password

### 2. **Database Schema (`prisma/schema.prisma`)**

```prisma
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique                    // Must be unique
  password  String                              // Hashed password
  name      String
  words     Word[]                              // One-to-many relationship
  createdAt DateTime @default(now())
}

model Word {
  id           Int      @id @default(autoincrement())
  word         String
  translation  String
  difficulty   Int      @default(1)
  userId       Int                              // Foreign key
  user         User     @relation(fields: [userId], references: [id])
}
```

**Key Points:**

- **Unique email** constraint prevents duplicate accounts
- **Password field** stores only hashed passwords
- **Relationships** allow users to have multiple words
- **Timestamps** track when records are created/updated

### 3. **API Routes**

#### Registration (`/api/auth/register`)

```typescript
// Flow:
1. Validate input (email, password, name)
2. Check if user already exists
3. Hash password with bcrypt
4. Create user in database
5. Return user data (without password)
```

#### Login (`/api/auth/login`)

```typescript
// Flow:
1. Validate input (email, password)
2. Find user by email
3. Compare password with stored hash
4. Return user data if successful
```

### 4. **Frontend Integration**

```typescript
// Registration
const response = await fetch("/api/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password, name }),
});

// Login
const response = await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
```

## 🚀 Setup Instructions

### 1. **Install Dependencies**

```bash
npm install prisma @prisma/client bcryptjs @types/bcryptjs
```

### 2. **Initialize Prisma**

```bash
npx prisma init
```

### 3. **Set Up Database**

For **local development**, add to `.env`:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/duocards"
```

For **Vercel deployment**:

1. Add Vercel Postgres to your project
2. Vercel automatically sets `DATABASE_URL`
3. Run `npx prisma db push` to create tables

### 4. **Generate Prisma Client**

```bash
npx prisma generate
```

### 5. **Test the System**

1. Start your app: `npm run dev`
2. Try registering a new user
3. Try logging in with that user
4. Check the database to see the hashed password

## 🔒 Security Features

### ✅ **Implemented**

- **Password hashing** with bcrypt (12 rounds)
- **Input validation** (email format, password strength)
- **Unique email** constraint
- **Generic error messages** (prevents email enumeration)
- **No password in responses**
- **Case-insensitive email** storage

### 🚧 **Next Steps (Optional)**

- **JWT tokens** for session management
- **Rate limiting** to prevent brute force attacks
- **Email verification** before account activation
- **Password reset** functionality
- **Two-factor authentication**

## 🧪 Testing the System

### 1. **Register a User**

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123",
    "name": "Test User"
  }'
```

### 2. **Login with User**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123"
  }'
```

## 🎯 What Happens Behind the Scenes

### **Registration Process:**

1. User fills out form with email, password, name
2. Frontend sends POST request to `/api/auth/register`
3. API validates input and checks for existing user
4. Password is hashed using bcrypt with 12 salt rounds
5. User record is created in database with hashed password
6. Success response returned (without password)

### **Login Process:**

1. User enters email and password
2. Frontend sends POST request to `/api/auth/login`
3. API finds user by email
4. bcrypt compares provided password with stored hash
5. If match, user data returned (without password)
6. If no match, generic error message returned

## 🐛 Common Issues & Solutions

### **"Prisma Client not generated"**

```bash
npx prisma generate
```

### **"Database connection failed"**

- Check your `DATABASE_URL` in `.env`
- Ensure database is running
- Verify connection string format

### **"Password validation failed"**

- Password must be 8+ characters
- Must contain uppercase, lowercase, and number
- Check the validation rules in `auth.ts`

### **"User already exists"**

- Email must be unique
- Check if you've already registered with that email
- Try a different email address

## 📚 Next Steps

Now that you have authentication working, you can:

1. **Add word management** - Create API routes for adding/editing words
2. **Implement sessions** - Add JWT tokens or cookies
3. **Create dashboard** - Build the main app interface
4. **Add word categories** - Extend the database schema
5. **Implement progress tracking** - Track learning progress

The foundation is solid and secure! 🎉
