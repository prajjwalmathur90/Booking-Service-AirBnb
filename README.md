# 🏨 Airbnb Booking Service

[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-green?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5.8-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Express.js](https://img.shields.io/badge/Express-v5.1-black?logo=express)](https://expressjs.com/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-v7.10-2D3748?logo=prisma)](https://www.prisma.io/)
[![MariaDB / MySQL](https://img.shields.io/badge/Database-MariaDB%20%2F%20MySQL-003545?logo=mariadb)](https://mariadb.org/)
[![Redis](https://img.shields.io/badge/Redis-Redlock%20%2B%20BullMQ-DC382D?logo=redis)](https://redis.io/)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow.svg)](https://opensource.org/licenses/ISC)

A high-performance, fault-tolerant, and event-driven **Booking Microservice** designed for an Airbnb-scale accommodation platform. Engineered with distributed systems best practices, this service solves critical real-world concurrency challenges such as **race conditions (double bookings)**, **network retry side-effects (non-idempotent charges/reservations)**, and **cross-service transaction orchestration**.

---

## 📑 Table of Contents

- [1. Getting Started & Installation](#1-getting-started--installation)
  - [Prerequisites](#prerequisites)
  - [Clone Repository](#clone-repository)
  - [Install Dependencies](#install-dependencies)
  - [Environment Configuration](#environment-configuration)
  - [Database Setup & Prisma Migrations](#database-setup--prisma-migrations)
  - [Running the Service](#running-the-service)
- [2. System Architecture & Design](#2-system-architecture--design)
  - [Microservices Ecosystem](#microservices-ecosystem)
  - [Internal Component Architecture](#internal-component-architecture)
  - [End-to-End Booking Lifecycle Workflow](#end-to-end-booking-lifecycle-workflow)
  - [Database Schema & ERD](#database-schema--erd)
  - [Project Directory Structure](#project-directory-structure)
- [3. Important & Impressive Engineering Features](#3-important--impressive-engineering-features)
  - [1. Distributed Locking with Redlock (Redis)](#1-distributed-locking-with-redlock-redis)
  - [2. Dual-Layer Idempotency & Pessimistic Row-Level Locking](#2-dual-layer-idempotency--pessimistic-row-level-locking)
  - [3. Asynchronous Event-Driven Messaging with BullMQ](#3-asynchronous-event-driven-messaging-with-bullmq)
  - [4. Next-Gen Prisma ORM 7 with Native MariaDB Adapter](#4-next-gen-prisma-orm-7-with-native-mariadb-adapter)
  - [5. Zero-Overhead Distributed Tracing via AsyncLocalStorage](#5-zero-overhead-distributed-tracing-via-asynclocalstorage)
  - [6. Strict Schema Validation with Zod](#6-strict-schema-validation-with-zod)
  - [7. Production-Ready Log Rotation with Winston](#7-production-ready-log-rotation-with-winston)
- [4. API Reference & Contracts](#4-api-reference--contracts)
  - [Create Pending Booking](#1-create-pending-booking)
  - [Confirm Booking](#2-confirm-booking)
  - [Health Check](#3-health-check)
- [5. Available NPM Scripts](#5-available-npm-scripts)
- [6. Error Handling Strategy](#6-error-handling-strategy)

---

## 1. Getting Started & Installation

Follow these steps to set up and run the Booking Service locally or in a staging environment.

### Prerequisites

Ensure you have the following installed on your machine:

- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher (or `pnpm` / `yarn`)
- **MariaDB** or **MySQL**: `v10.5+` running locally or via Docker
- **Redis Server**: `v6.0+` running locally or via Docker

> **Quick Docker Compose for local infrastructure (MariaDB + Redis):**
> ```bash
> docker run -d --name airbnb-mariadb -p 3306:3306 -e MYSQL_ROOT_PASSWORD=rootpassword -e MYSQL_DATABASE=airbnb_booking_dev mariadb:latest
> docker run -d --name airbnb-redis -p 6379:6379 redis:alpine
> ```

---

### Clone Repository

Clone the repository to your local machine using Git:

```bash
git clone https://github.com/prajjwalmathur90/Booking-Service-AirBnb.git
cd Booking-Service-AirBnb
```

---

### Install Dependencies

Install all production and development dependencies:

```bash
npm install
```

---

### Environment Configuration

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

If `.env.example` does not exist, configure your `.env` file with the following variables:

```env
# Server Configuration
PORT=3001

# MariaDB / MySQL Database Connection (Prisma ORM)
DATABASE_URL="mysql://root:rootpassword@localhost:3306/airbnb_booking_dev"
DATABASE_USER=root
DATABASE_PASSWORD=rootpassword
DATABASE_NAME=airbnb_booking_dev
DATABASE_HOST=localhost
DATABASE_PORT=3306

# Redis & Redlock Configuration
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_SERVER_URL="redis://localhost:6379"
LOCK_TTL=60000

# Core Inventory Microservice Gateway Endpoint
HOTEL_SERVICE_URL="http://localhost:3003/api/rooms"
```

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Port on which the Booking Service runs | `3001` |
| `DATABASE_URL` | MariaDB / MySQL connection URI | Required |
| `REDIS_SERVER_URL` | Redis connection URL for Redlock & BullMQ | `redis://localhost:6379` |
| `LOCK_TTL` | Redlock lock time-to-live in milliseconds | `60000` (60s) |
| `HOTEL_SERVICE_URL` | Base URL of the Core Inventory Service | `http://localhost:3003/api/rooms` |

---

### Database Setup & Prisma Migrations

Generate the Prisma Client and apply database schema migrations:

```bash
# 1. Format the Prisma schema
npm run prisma:format

# 2. Run pending migrations to create tables in MariaDB/MySQL
npm run prisma:migrate

# 3. Generate the custom Prisma Client
npm run prisma:generate
```

*(Optional)* Launch Prisma Studio to visually inspect and manage database records:

```bash
npm run prisma:studio
```

---

### Running the Service

#### Development Mode (with hot-reloading via `tsx watch`):

```bash
npm run dev
```

#### Production Mode:

```bash
npm start
```

Once started, the service will initialize connections to MariaDB and Redis, listening at:
```
http://localhost:3001
```

---

## 2. System Architecture & Design

### Microservices Ecosystem

The Airbnb platform backend follows a decoupled **Microservices Architecture** to scale discrete domains independently:

```mermaid
flowchart TD
    Client["Client / Web / Mobile App"] --> Gateway["API Gateway / Client Proxy"]

    subgraph Platform Services
        Inventory["🏨 Core Inventory Service (AirBnb)\n(Hotels, Rooms, Room Categories)"]
        Booking["💳 Booking Service (:3001)\n(Redlock, Transactions, Idempotency)"]
        Notification["📧 Notification Service\n(BullMQ Workers, Handlebars, Nodemailer)"]
    end

    subgraph Infrastructure
        MariaDB[("🗄️ MariaDB / MySQL\n(ACID Data Store)")]
        RedisNode[("⚡ Redis Instance\n(Redlock Distributed Locks & BullMQ)")]
    end

    Gateway -->|Browse Hotels & Rooms| Inventory
    Gateway -->|Reserve & Confirm Booking| Booking

    Booking -->|1. Query & Lock Available Rooms| Inventory
    Booking -->|2. Acquire Redlock & Check-In Lock| RedisNode
    Booking -->|3. Persist Booking & Idempotency Key| MariaDB
    Booking -->|4. Push 'BOOKING_CONFIRMED' Job| RedisNode
    RedisNode -->|5. Consume Email Job| Notification
```

- **Core Inventory Service (`AirBnb`)**: Manages hotels, room tiers, physical room instances, and pricing.
- **Booking Service (`Booking-Service`)**: The transaction powerhouse. Manages reservations, concurrency locks, idempotency keys, and triggers order events.
- **Notification Service (`Notification-Service`)**: Background worker that consumes queue events and delivers templated transactional emails without blocking booking latency.

---

### Internal Component Architecture

The service adheres strictly to the **Controller-Service-Repository** pattern with clean separation of concerns:

```
[ Incoming Request ]
         │
         ▼
[ Correlation Middleware ] ──── Attaches unique UUID & initializes AsyncLocalStorage
         │
         ▼
[ Zod Validation Middleware ] ─ Parses & validates incoming Request Body / Query
         │
         ▼
[ Booking Controller ] ──────── HTTP serialization & standard response envelope
         │
         ▼
[ Booking Service ] ─────────── Business logic, Redlock acquisition, Inventory orchestration
      ├──▶ [ Hotel Gateway ] ── Communicates with external Core Inventory Service
      ├──▶ [ Redlock Lock ] ─── Redis distributed mutex for race condition safety
      ├──▶ [ BullMQ Queue ] ── Enqueues asynchronous email notification events
      └──▶ [ Booking Repo ] ─── Interacts with DB via Prisma & raw SQL pessimistic locks
               │
               ▼
        [ MariaDB / MySQL ]
```

---

### End-to-End Booking Lifecycle Workflow

The entire lifecycle from reservation to final confirmation follows a multi-stage concurrency-safe sequence:

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Client
    participant API as Booking Service
    participant Redis as Redis (Redlock)
    participant Inventory as Hotel Service
    participant DB as MariaDB (Prisma)
    participant Queue as BullMQ (Redis)

    Note over User, Queue: PHASE 1: CREATE PENDING BOOKING
    User->>API: POST /api/v1/booking (hotelId, roomCategoryId, dates)
    API->>Inventory: GET /available (roomCategoryId, checkIn, checkOut)
    Inventory-->>API: List of available room IDs
    API->>Redis: redlock.acquire(["hotel:{hotelId}"], TTL=60s)
    Redis-->>API: Lock Granted
    API->>DB: INSERT INTO Booking (Status=PENDING)
    API->>DB: INSERT INTO IdempotencyKey (idemKey=UUID, finalised=false)
    API->>Inventory: PUT /update-booking-id (bookingId, roomIds)
    API->>Redis: lock.unlock()
    API-->>User: 201 Created { bookingId, idempotencyKey }

    Note over User, Queue: PHASE 2: CONFIRM BOOKING
    User->>API: POST /api/v1/booking/confirm/:idempotencyKey?email=user@test.com
    API->>DB: prisma.$transaction (Interactive ACID Transaction)
    API->>DB: SELECT * FROM IdempotencyKey WHERE idemKey = :key FOR UPDATE
    alt Key not found or already finalised
        API-->>User: 404 Not Found / 409 Conflict
    else Valid pending key
        API->>DB: UPDATE Booking SET bookingStatus = 'CONFIRMED'
        API->>DB: UPDATE IdempotencyKey SET finalised = true
        DB-->>API: Transaction Committed
        API->>Queue: mailerQueue.add("payload-mailer", { to, templateId, ... })
        API-->>User: 200 OK (Booking confirmed)
    end
```

---

### Database Schema & ERD

The database schema is modeled using Prisma ORM with strict relationships and state tracking:

```mermaid
erDiagram
    Booking ||--o| IdempotencyKey : "has one"

    Booking {
        int id PK "auto-increment"
        int userId "User identifier"
        int hotelId "Hotel identifier"
        int roomCategoryId "Category identifier"
        datetime checkInDate "Check-in timestamp"
        datetime checkOutDate "Check-out timestamp"
        int totalGuest "Guest count"
        int bookingAmount "Total price in cents/currency"
        BookingStatus bookingStatus "PENDING | CONFIRMED | CANCELLED"
        datetime createdAt "Creation timestamp"
        datetime updatedAt "Auto-updated timestamp"
    }

    IdempotencyKey {
        int id PK "auto-increment"
        string idemKey UK "Unique UUID token"
        boolean finalised "State flag (false=pending, true=finalized)"
        int bookingId FK,UK "Foreign key to Booking"
        datetime createdAt "Creation timestamp"
        datetime updatedAt "Auto-updated timestamp"
    }
```

---

### Project Directory Structure

```
Booking-Service/
├── .agents/                      # Agent & IDE skill configurations
├── generated/
│   └── prisma/                   # Custom generated Prisma Client output
├── logs/                         # Rolling log directory generated by Winston
│   └── YYYY-MM-DD-app.log        # Daily rotated log files
├── prisma/
│   ├── migrations/               # SQL migration history
│   └── schema.prisma             # Declarative Prisma schema definition
├── src/
│   ├── config/
│   │   ├── index.ts              # Global environment config loader
│   │   ├── logger.config.ts      # Winston logger with DailyRotateFile & correlation ID
│   │   ├── prisma.ts             # Prisma Client instance with MariaDB adapter
│   │   └── redis.config.ts       # IORedis connection & Redlock configuration
│   ├── controllers/
│   │   ├── booking.controller.ts # Booking HTTP route controllers
│   │   └── ping.controller.ts    # Healthcheck controller
│   ├── dtos/
│   │   ├── booking.dto.ts        # Zod request validation schemas & TypeScript types
│   │   └── notification.dto.ts   # Notification payload schema
│   ├── gateway/
│   │   └── hotel.api.ts          # Axios HTTP client for Core Inventory Service
│   ├── middlewares/
│   │   ├── correlation.middleware.ts # AsyncLocalStorage correlation ID injector
│   │   ├── error.middleware.ts       # Centralized global error handler
│   │   ├── route-not-found.middleware.ts # 404 handler
│   │   └── validate.ts               # Generic Zod validation middleware
│   ├── producers/
│   │   └── email.producer.ts     # BullMQ email queue job dispatcher
│   ├── queues/
│   │   └── email.queue.ts        # BullMQ email queue definition
│   ├── repositories/
│   │   └── booking.repository.ts # Data layer: queries, pessimistic raw locks, transactions
│   ├── routers/
│   │   ├── v1/
│   │   │   ├── booking.router.ts # /api/v1/booking routes
│   │   │   ├── ping.router.ts    # /api/v1/ping routes
│   │   │   └── index.router.ts   # v1 router aggregator
│   │   └── v2/
│   │       └── index.router.ts   # Scalable versioning skeleton
│   ├── services/
│   │   └── booking.service.ts    # Core booking business orchestration logic
│   ├── utils/
│   │   ├── errors/app.error.ts   # Normalized AppError classes (badRequest, notFound, etc.)
│   │   ├── helpers/request.helpers.ts # AsyncLocalStorage store & getters
│   │   ├── idempotency-key/      # UUID generator utility
│   │   └── responses/app.response.ts  # Standardized API response formatters
│   └── server.ts                 # Application bootstrap & Express server setup
├── .env                          # Local environment variables
├── package.json                  # Dependencies and execution scripts
├── prisma7.config.ts             # Prisma ORM 7 migration & schema configuration
└── tsconfig.json                 # TypeScript compiler configuration
```

---

## 3. Important & Impressive Engineering Features

### 1. Distributed Locking with Redlock (Redis)
In high-throughput hospitality booking systems, **double-booking a room** when two users submit requests at the exact same millisecond is a catastrophic failure mode.
- This service integrates **Redlock** with configurable drift factor, retry attempts, and retry jitter delays:
  ```typescript
  export const redlock = new Redlock(
    [getRedisConnectionObj() as unknown as CompatibleRedisClient],
    {
      driftFactor: 0.01,
      retryCount: 3,
      retryDelay: 200,
      retryJitter: 100,
    }
  );
  ```
- Before creating a reservation or modifying room inventory, a lock is acquired on the specific resource key (`hotel:{hotelId}`).
- A strict `finally` block guarantees that locks are released safely regardless of operational success or unexpected failure, preventing deadlocks.

---

### 2. Dual-Layer Idempotency & Pessimistic Row-Level Locking
Network retries (e.g. mobile client retry due to high latency or transient 504 Gateway Timeout) can cause duplicate charges or multiple booking records.
1. **Application-Level Idempotency Tokens**:
   - Each booking is assigned a cryptographic UUIDv4 token upon creation.
   - The confirmation step requires this key.
2. **Pessimistic Database Locking (`SELECT ... FOR UPDATE`)**:
   - When confirming a booking, the service wraps the operation in an ACID `prisma.$transaction`.
   - It performs an explicit row-level lock on the idempotency key table:
     ```typescript
     const idempotencyKey: Array<IdempotencyKey> = await tx.$queryRaw`
       SELECT * FROM IdempotencyKey WHERE IdemKey = ${key} FOR UPDATE
     `;
     ```
   - If a duplicate confirmation request arrives concurrently, the second transaction is blocked at the database engine until the first completes.
   - Once the first transaction sets `finalised: true`, the second immediately detects the finalized flag and throws a `409 Conflict: Idempotency Key already finalized!`, preventing double-processing.

---

### 3. Asynchronous Event-Driven Messaging with BullMQ
- Rather than synchronously making SMTP calls or HTTP requests to send booking emails (which can add 1–3 seconds to API latency and fail if the mail server is down), the Booking Service uses **BullMQ** on top of Redis.
- Upon successful transaction commitment, a lightweight payload (`MAILER_PAYLOAD`) is placed onto `queue-mailer`.
- The API responds immediately to the user with a sub-50ms response time, while the background Notification Service handles retries, rate limits, and email rendering.

---

### 4. Next-Gen Prisma ORM 7 with Native MariaDB Adapter
- Uses the latest **Prisma ORM 7** configured with the high-performance native driver adapter:
  ```typescript
  import { PrismaMariaDb } from "@prisma/adapter-mariadb";
  const adapter = new PrismaMariaDb(process.env.DATABASE_URL as string);
  const prisma = new PrismaClient({ adapter });
  ```
- This bypasses standard generic drivers to yield lower connection overhead, faster connection pooling, and full compatibility with MariaDB features.

---

### 5. Zero-Overhead Distributed Tracing via AsyncLocalStorage
- Debugging microservice call chains across multiple asynchronous callbacks and Promise chains can be tedious.
- This service implements Node.js native `AsyncLocalStorage` via `attachCorrelationIdMiddleware`:
  - Automatically captures incoming `x-correlation-id` headers or generates a unique UUID.
  - Passes the correlation context across all asynchronous execution contexts without polluting function signatures.
  - Injects `correlationId` into **every single log entry** produced by Winston.

---

### 6. Strict Schema Validation with Zod
- All incoming requests are validated against strict Zod DTO schemas before reaching controllers:
  - Dates are verified to be ISO-8601 compliant (`datetime()`).
  - Guest counts and booking amounts must be positive integers (`min(1)`).
  - Invalid payloads are rejected immediately with structured `400 Bad Request` messages.

---

### 7. Production-Ready Log Rotation with Winston
- Monolithic log files quickly consume disk space and cause production server crashes.
- Configured with `winston-daily-rotate-file`:
  - Daily automatic log rotation (`YYYY-MM-DD-app.log`).
  - Strict maximum file size caps (`20MB`).
  - Automatic retention pruning after `14 days`.
  - JSON-formatted structured logs ready for ingestion by ELK Stack, Grafana Loki, or Datadog.

---

## 4. API Reference & Contracts

### Base URL
```
http://localhost:3001/api/v1
```

---

### 1. Create Pending Booking
Checks room inventory, acquires distributed lock, creates a `PENDING` booking, and returns an idempotency key.

- **URL:** `/api/v1/booking`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`

#### Request Body
```json
{
  "userId": 101,
  "hotelId": 12,
  "roomCategoryId": 3,
  "checkInDate": "2026-11-01T14:00:00.000Z",
  "checkOutDate": "2026-11-04T10:00:00.000Z",
  "totalGuest": 2,
  "bookingAmount": 450
}
```

#### cURL Example
```bash
curl -X POST http://localhost:3001/api/v1/booking \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 101,
    "hotelId": 12,
    "roomCategoryId": 3,
    "checkInDate": "2026-11-01T14:00:00.000Z",
    "checkOutDate": "2026-11-04T10:00:00.000Z",
    "totalGuest": 2,
    "bookingAmount": 450
  }'
```

#### Response (`201 Created`)
```json
{
  "success": true,
  "message": "Booking created successfully",
  "data": {
    "bookingId": 1,
    "idempotencyKey": "a92e106c-8438-4e12-8c11-9730248a8039"
  }
}
```

---

### 2. Confirm Booking
Verifies idempotency key, locks row pessimistically, sets status to `CONFIRMED`, and enqueues notification email.

- **URL:** `/api/v1/booking/confirm/:idempotencyKey`
- **Method:** `POST`
- **Query Parameters:** `email` *(string, required)*

#### cURL Example
```bash
curl -X POST "http://localhost:3001/api/v1/booking/confirm/a92e106c-8438-4e12-8c11-9730248a8039?email=traveler@example.com"
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Booking confirmed!",
  "data": {
    "id": 1,
    "userId": 101,
    "hotelId": 12,
    "roomCategoryId": 3,
    "checkInDate": "2026-11-01T14:00:00.000Z",
    "checkOutDate": "2026-11-04T10:00:00.000Z",
    "totalGuest": 2,
    "bookingAmount": 450,
    "bookingStatus": "CONFIRMED",
    "createdAt": "2026-10-12T14:20:00.000Z",
    "updatedAt": "2026-10-12T14:20:05.000Z"
  }
}
```

#### Error Responses
- `404 Not Found`: Idempotency key does not exist.
- `409 Conflict`: Idempotency key has already been finalized.

---

### 3. Health Check
Verifies that the service is running and healthy.

- **URL:** `/api/v1/ping`
- **Method:** `GET`

#### cURL Example
```bash
curl http://localhost:3001/api/v1/ping
```

#### Response (`200 OK`)
```json
{
  "message": "Pong"
}
```

---

## 5. Available NPM Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts server in development mode using `tsx watch` for auto-reloading |
| `npm start` | Boots the application server using `tsx` |
| `npm run prisma:format` | Validates and formats the `prisma/schema.prisma` file |
| `npm run prisma:migrate` | Runs Prisma development migrations against the target database |
| `npm run prisma:migrate:deploy` | Applies migrations in production/CI/CD pipelines |
| `npm run prisma:generate` | Compiles the custom Prisma Client into `generated/prisma/` |
| `npm run prisma:studio` | Launches the interactive Prisma Studio database management GUI |

---

## 6. Error Handling Strategy

The service implements a unified, centralized error-handling system:
1. **Operational Errors (`AppError`)**: Clean status code mappings:
   - `400 Bad Request` — Schema validation or malformed UUID failure.
   - `404 Not Found` — Resource, room, or idempotency key missing.
   - `409 Conflict` — State conflict (e.g. idempotency key already processed).
   - `500 Internal Server Error` — Unhandled exceptions, lock acquisition failures.
2. **Global Fallback Handler (`genericErrorHandler`)**: Catches uncaught rejections and standardizes errors into a clean JSON response format:
   ```json
   {
     "success": false,
     "message": "Detailed error explanation",
     "data": null
   }
   ```
3. **Structured Tracing**: All errors capture the current request's `correlationId` to make debugging across microservice logs immediate and painless.

---

## 👤 Author & Maintainer

- **Developer:** Prajjwal Mathur
- **Repository:** [Booking-Service-AirBnb](https://github.com/prajjwalmathur90/Booking-Service-AirBnb)
