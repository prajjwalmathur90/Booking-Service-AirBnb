# Booking Service - Project Report

## Overview
This document provides a comprehensive overview of the features, architecture, and technical decisions implemented in the **Booking Service** backend project. The project is an Express.js application built with TypeScript, designed to handle hotel bookings robustly with a strong focus on concurrency control, idempotency, data integrity, and **asynchronous email notifications via a message queue**.

## Technology Stack
- **Framework**: Express.js with TypeScript (`tsx`, `ts-node`)
- **Database & ORM**: MySQL database managed via Prisma ORM (`@prisma/client`, `@prisma/adapter-mariadb`)
- **Caching & Concurrency**: Redis with `ioredis` and `redlock` for distributed locking
- **Message Queue**: BullMQ backed by Redis for asynchronous job processing (email notifications)
- **Validation**: `zod` for strict request body and query parameter validation
- **Logging**: `winston` and `winston-daily-rotate-file` for persistent, structured logging
- **Utilities**: `uuid` for generating unique idempotency keys

## Architectural Patterns
The project follows a layered architecture to ensure separation of concerns, scalability, and maintainability:
- **Controllers** (`src/controllers`): Responsible for handling incoming HTTP requests, orchestrating service calls, and formatting HTTP responses.
- **Services** (`src/services`): Contains the core business logic, such as acquiring distributed locks, managing transactions, and handling the core booking flow.
- **Repositories** (`src/repositories`): Abstracts the data layer, encapsulating all Prisma database interactions and raw SQL queries.
- **DTOs (Data Transfer Objects)** (`src/dtos`): Utilizes Zod schemas to define and validate the structure of incoming data for both request bodies and query parameters.
- **Middlewares** (`src/middlewares`): Centralized request processing components (e.g., error handling, request body validation, query parameter validation, and correlation tracking).
- **Routers** (`src/routers`): Defines the API endpoints with support for versioning (e.g., `v1`).
- **Producers** (`src/producers`): Responsible for publishing jobs (messages) onto BullMQ queues. Acts as the bridge between the service layer and the message queue.
- **Queues** (`src/queues`): Defines and configures BullMQ queue instances that connect to Redis for asynchronous job processing.

## Key Features & Functionalities

### 1. Robust Booking Workflow (Concurrency Control via Distributed Locking)
To prevent severe race conditions—such as double-booking a hotel when multiple concurrent requests are made across different servers—the service employs **Redis-based Distributed Locking** implemented in `src/services/booking.service.ts`.
- **Implementation Detail**: When a user initiates a booking (`createBookingService`), the service attempts to acquire a distributed lock using `redlock`. It locks a highly specific resource identifier mapped to the hotel (e.g., `hotel:{hotelId}`).
- **Purpose & Impact**: This mechanism guarantees that even in a horizontally scaled environment with multiple Node.js instances, only *one* process can execute the booking creation logic for a specific hotel at any given time. This strictly prevents inventory overselling and ensures that database inserts for bookings are serialized per hotel.
- **Error Isolation**: The lock acquisition and booking creation are wrapped in **separate try-catch blocks**. This provides granular error reporting — if the lock cannot be acquired, the user receives a clear "failed to acquire lock" message; if the booking itself fails after the lock is secured, the user receives a distinct "failed to create booking" error. This separation aids in debugging and provides precise error feedback to the API consumer.

### 2. Idempotency for Resilient APIs (Database Pessimistic Locking)
The service implements a strict idempotency mechanism to handle network failures, client retries, and duplicate requests gracefully. This ensures that critical actions like confirming a booking or processing a payment are never executed twice. The core of this mechanism relies on **Pessimistic Row-Level Locking** implemented in `src/repositories/booking.repository.ts`.
- **Idempotency Key Generation**: Upon initial booking creation, an `idempotencyKey` (UUID) is generated and persisted in the database, strongly linked to the new booking.
- **Pessimistic Row-level Locking (`SELECT ... FOR UPDATE`)**: During the booking confirmation process (`confirmBookingService`), the service initiates a Prisma transaction. Within this transaction, it calls `getIdempotencyKeyWithLock` which executes a raw SQL query: `SELECT * FROM IdempotencyKey WHERE IdemKey = ? FOR UPDATE`.
- **How it Works**: The `FOR UPDATE` clause instructs the MySQL database to place a strict write lock on the specific `IdempotencyKey` row. If two concurrent "confirm booking" requests arrive with the same key, the database forces the second request to block and wait until the first request's transaction is fully committed or rolled back.
- **Double-Execution Prevention**: Once the first request secures the lock, it checks if the key is `finalised`. It confirms the booking, marks the key as `finalised`, and commits. When the second blocked request finally acquires the lock, it will see the `finalised` state is now true, and immediately reject the request with a `409 Conflict` error, successfully preventing duplicate execution.

### 3. Asynchronous Email Notification System (BullMQ + Redis)
Upon successful booking confirmation, the service triggers an **asynchronous email notification** to the user. This is implemented using a **producer-consumer pattern** powered by **BullMQ** and **Redis**, ensuring that email delivery does not block the API response or slow down the booking flow.

#### Architecture & Data Flow
The email notification pipeline consists of the following components:

1. **Notification DTO** (`src/dtos/notification.dto.ts`):
   Defines the shape of the email payload using a Zod schema. Every notification job must include:
   - `to` (string): The recipient's email address.
   - `subject` (string): The subject line of the email.
   - `templateId` (string): An identifier for the email template to render (e.g., `"BOOKING_CONFIRMED"`).
   - `params` (Record<string, any>): A dynamic key-value map of template variables (e.g., `{ name: "Prajjwal", orderId: 42 }`).

2. **Email Queue** (`src/queues/email.queue.ts`):
   Creates a named BullMQ `Queue` instance called `"queue-mailer"`. This queue connects to Redis using a shared connection factory (`getRedisConnectionObj()`), ensuring it reuses the same Redis connection configuration as the rest of the application. The queue acts as a persistent buffer — jobs survive server restarts because they are stored in Redis.

3. **Email Producer** (`src/producers/email.producer.ts`):
   Exposes the `addEmailToQueue()` function, which accepts a `NotificationDto` payload and pushes it onto the `"queue-mailer"` BullMQ queue using the job name `"payload-mailer"`. This function is called from the service layer immediately after a booking is confirmed.

4. **Consumer (Notification Service)**:
   A separate **Notification Service** (running independently at `c:\Users\pra90\Documents\Backend\Notfication-Service`) listens on the same `"queue-mailer"` Redis queue. It picks up jobs, renders the email template using the `templateId` and `params`, and sends the actual email via an SMTP provider.

#### Why This Design Matters
- **Non-Blocking**: The API response is returned to the client immediately after the booking is confirmed. Email delivery happens in the background and does not add latency to the API response.
- **Fault Tolerant**: If the Notification Service is temporarily down, email jobs remain safely persisted in Redis. They will be processed as soon as the consumer comes back online — no emails are lost.
- **Decoupled**: The Booking Service has zero knowledge of *how* emails are sent (SMTP provider, templates, retries). It only knows *what* to send. This separation of concerns makes each service independently deployable and testable.
- **Scalable**: Multiple instances of the Notification Service can consume from the same queue, enabling horizontal scaling of email processing independently of the booking API.

#### Integration Point
The `addEmailToQueue()` call is made **inside** the `prisma.$transaction` block in `confirmBookingService`. This means the email job is enqueued within the same transactional context as the booking confirmation and idempotency key finalization:

```typescript
const booking = await confirmBooking(tx, idempotencyKeyData.bookingId);
await finailizeIdempotencyKey(tx, idempotencyKey);

addEmailToQueue({
  to: email,
  subject: "Booking confirmed",
  templateId: "BOOKING_CONFIRMED",
  params: { name: "Prajjwal", orderId: booking.id },
});
```

### 4. Database Transactions
Critical state mutations, such as finalizing an idempotency key and updating the booking status to `CONFIRMED`, are wrapped inside a single **Prisma Transaction** (`prisma.$transaction`). This ensures ACID compliance—either both updates succeed, or if one fails, the entire operation is rolled back, preventing orphaned or inconsistent states.

### 5. Comprehensive Validation (Request Body & Query Parameters)
The service implements a **dual-layer validation system** using `zod` and custom Express middlewares (`src/middlewares/validate.ts`), covering both request bodies and URL query parameters.

#### Request Body Validation (`validateRequest`)
- Applied to endpoints that accept JSON payloads (e.g., booking creation).
- Uses `schema.safeParse(req.body)` to validate and parse the request body.
- If the body is `undefined` (missing `Content-Type: application/json`), it throws a descriptive `400 Bad Request` error immediately.
- On validation failure, it returns all Zod issue details to the client for easy debugging.
- On success, it overwrites `req.body` with the parsed (and sanitized) data, stripping any extra fields not defined in the schema.

#### Query Parameter Validation (`validateQuery`)
- Applied to endpoints that accept query parameters (e.g., booking confirmation with `?email=...`).
- Uses `schema.safeParse(req.query)` to validate query parameters against a Zod schema.
- The `confirmBookingQuerySchema` validates that the `email` query parameter is present and is a valid email format using `z.string().email()`.
- **Note**: Unlike `validateRequest`, the `validateQuery` middleware does *not* reassign `req.query` after parsing because Express treats `req.query` as a read-only getter property.

#### Validation Schemas
- **`createBookingSchema`**: Validates `userId` (number), `hotelId` (number), `totalGuest` (number, min 1), `bookingAmount` (number, min 1).
- **`confirmBookingQuerySchema`**: Validates `email` (string, valid email format).
- **`notificationSchema`**: Validates the internal notification payload structure (`to`, `subject`, `templateId`, `params`).

### 6. Standardized Error Handling
- **App Errors**: Uses a custom error utility (`app.error.ts`) to throw standardized HTTP errors (e.g., `badRequest`, `notFound`, `conflict`, `internalServerError`).
- **Global Error Middleware**: A centralized `error.middleware.ts` catches all unhandled exceptions and formats them into a consistent JSON response structure, preventing stack traces from leaking to the client in production.
- **Route Not Found**: A dedicated middleware (`route-not-found.middleware.ts`) gracefully handles 404 scenarios.

### 7. Structured and Rotating Logs
The application is equipped with a robust logging setup using `winston`:
- **Daily Rotation**: Logs are rotated daily using `winston-daily-rotate-file`, ensuring log files do not grow indefinitely and consume all disk space.
- **Actionable Logging**: Important lifecycle events (booking creation, idempotency key generation, confirmation, cancellation) are logged systematically in the repository layer to facilitate debugging and observability.

### 8. Correlation Tracking (Observability)
A `correlation.middleware.ts` is used to inject a unique correlation ID into every request. This ID can be attached to logs and responses, allowing developers to trace a single request's lifecycle across various services and log files in a microservices environment.

### 9. Redis Connection Management (Singleton Pattern)
The Redis configuration (`src/config/redis.config.ts`) implements a **closure-based singleton pattern** via `connectRedis()`. This ensures that only a single Redis connection instance is created and reused across the entire application — by the Redlock distributed locking system, the BullMQ email queue, and any other Redis-dependent component. This prevents connection leaks and reduces overhead from repeatedly establishing new connections.

## API Endpoints

| Method | Endpoint | Middleware | Description |
|--------|--------|------------|-------------|
| `POST` | `/api/v1/bookings/` | `validateRequest(createBookingSchema)` | Creates a new booking with distributed locking. Returns `bookingId` and `idempotencyKey`. |
| `POST` | `/api/v1/bookings/confirm/:idempotencyKey?email=<email>` | `validateQuery(confirmBookingQuerySchema)` | Confirms a booking using the idempotency key. Validates the `email` query parameter and triggers an asynchronous confirmation email via BullMQ. |

## Database Schema Highlights
The database consists of two primary models:
- **Booking**: Stores booking details including `userId`, `hotelId`, `bookingAmount`, `totalGuest`, and `bookingStatus` (`PENDING`, `CONFIRMED`, `CANCELLED`).
- **IdempotencyKey**: Stores the `idemKey` mapped uniquely to a `bookingId` and tracks its `finalised` state (boolean) to manage idempotency validations.

## System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                          CLIENT REQUEST                              │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     EXPRESS MIDDLEWARE PIPELINE                       │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────┐  │
│  │ Correlation ID   │  │ validateRequest  │  │  validateQuery     │  │
│  │ Middleware        │─▶│ (req.body)       │─▶│  (req.query)       │  │
│  └─────────────────┘  └──────────────────┘  └────────────────────┘  │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        CONTROLLER LAYER                              │
│             (Extracts params/query, calls services)                  │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         SERVICE LAYER                                │
│  ┌──────────────────────────┐  ┌─────────────────────────────────┐  │
│  │  createBookingService    │  │   confirmBookingService         │  │
│  │  - Acquire Redlock       │  │   - Prisma $transaction         │  │
│  │  - Create Booking        │  │   - SELECT FOR UPDATE (lock)    │  │
│  │  - Generate Idem Key     │  │   - Confirm Booking             │  │
│  └──────────────────────────┘  │   - Finalize Idem Key           │  │
│                                │   - Enqueue Email (BullMQ)      │  │
│                                └─────────────────────────────────┘  │
└────────────┬──────────────────────────────┬──────────────────────────┘
             │                              │
             ▼                              ▼
┌────────────────────────┐    ┌──────────────────────────────────────┐
│    REPOSITORY LAYER    │    │         PRODUCER LAYER               │
│  (Prisma DB Queries)   │    │  addEmailToQueue() ──▶ BullMQ Queue │
└────────────┬───────────┘    └──────────────┬───────────────────────┘
             │                               │
             ▼                               ▼
┌────────────────────────┐    ┌──────────────────────────────────────┐
│     MySQL Database     │    │            Redis                     │
│   (Booking, Idem Key)  │    │  (Distributed Lock + Email Queue)   │
└────────────────────────┘    └──────────────┬───────────────────────┘
                                             │
                                             ▼
                              ┌──────────────────────────────────────┐
                              │      NOTIFICATION SERVICE            │
                              │  (Separate Microservice)             │
                              │  - Consumes from "queue-mailer"      │
                              │  - Renders email template            │
                              │  - Sends email via SMTP              │
                              └──────────────────────────────────────┘
```

---
*Report generated automatically highlighting the technical achievements and capabilities of the Booking Service project.*
