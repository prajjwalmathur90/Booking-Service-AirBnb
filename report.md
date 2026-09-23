# Booking Service - Project Report

## Overview
This document provides a comprehensive overview of the features, architecture, and technical decisions implemented in the **Booking Service** backend project. The project is an Express.js application built with TypeScript, designed to handle hotel bookings robustly with a strong focus on concurrency control, idempotency, and data integrity.

## Technology Stack
- **Framework**: Express.js with TypeScript (`tsx`, `ts-node`)
- **Database & ORM**: MySQL database managed via Prisma ORM (`@prisma/client`, `@prisma/adapter-mariadb`)
- **Caching & Concurrency**: Redis with `ioredis` and `redlock` for distributed locking
- **Validation**: `zod` for strict request payload validation
- **Logging**: `winston` and `winston-daily-rotate-file` for persistent, structured logging
- **Utilities**: `uuid` for generating unique idempotency keys

## Architectural Patterns
The project follows a layered architecture to ensure separation of concerns, scalability, and maintainability:
- **Controllers** (`src/controllers`): Responsible for handling incoming HTTP requests, orchestrating service calls, and formatting HTTP responses.
- **Services** (`src/services`): Contains the core business logic, such as acquiring distributed locks, managing transactions, and handling the core booking flow.
- **Repositories** (`src/repositories`): Abstracts the data layer, encapsulating all Prisma database interactions and raw SQL queries.
- **DTOs (Data Transfer Objects)** (`src/dtos`): Utilizes Zod schemas to define and validate the structure of incoming data.
- **Middlewares** (`src/middlewares`): Centralized request processing components (e.g., error handling, request validation, and correlation tracking).
- **Routers** (`src/routers`): Defines the API endpoints with support for versioning (e.g., `v1`).

## Key Features & Functionalities

### 1. Robust Booking Workflow (Concurrency Control via Distributed Locking)
To prevent severe race conditions—such as double-booking a hotel when multiple concurrent requests are made across different servers—the service employs **Redis-based Distributed Locking** implemented in `src/services/booking.service.ts`.
- **Implementation Detail**: When a user initiates a booking (`createBookingService`), the service attempts to acquire a distributed lock using `redlock`. It locks a highly specific resource identifier mapped to the hotel (e.g., `hotel:{hotelId}`).
- **Purpose & Impact**: This mechanism guarantees that even in a horizontally scaled environment with multiple Node.js instances, only *one* process can execute the booking creation logic for a specific hotel at any given time. This strictly prevents inventory overselling and ensures that database inserts for bookings are serialized per hotel.

### 2. Idempotency for Resilient APIs (Database Pessimistic Locking)
The service implements a strict idempotency mechanism to handle network failures, client retries, and duplicate requests gracefully. This ensures that critical actions like confirming a booking or processing a payment are never executed twice. The core of this mechanism relies on **Pessimistic Row-Level Locking** implemented in `src/repositories/booking.repository.ts`.
- **Idempotency Key Generation**: Upon initial booking creation, an `idempotencyKey` (UUID) is generated and persisted in the database, strongly linked to the new booking.
- **Pessimistic Row-level Locking (`SELECT ... FOR UPDATE`)**: During the booking confirmation process (`confirmBookingService`), the service initiates a Prisma transaction. Within this transaction, it calls `getIdempotencyKeyWithLock` which executes a raw SQL query: `SELECT * FROM IdempotencyKey WHERE IdemKey = ? FOR UPDATE`.
- **How it Works**: The `FOR UPDATE` clause instructs the MySQL database to place a strict write lock on the specific `IdempotencyKey` row. If two concurrent "confirm booking" requests arrive with the same key, the database forces the second request to block and wait until the first request's transaction is fully committed or rolled back.
- **Double-Execution Prevention**: Once the first request secures the lock, it checks if the key is `finalised`. It confirms the booking, marks the key as `finalised`, and commits. When the second blocked request finally acquires the lock, it will see the `finalised` state is now true, and immediately reject the request with a `409 Conflict` error, successfully preventing duplicate execution.

### 3. Database Transactions
Critical state mutations, such as finalizing an idempotency key and updating the booking status to `CONFIRMED`, are wrapped inside a single **Prisma Transaction** (`prisma.$transaction`). This ensures ACID compliance—either both updates succeed, or if one fails, the entire operation is rolled back, preventing orphaned or inconsistent states.

### 4. Comprehensive Validation
Using `zod`, all incoming requests are validated against strict schemas (e.g., `CreateBookingDto`).
- Enforces data types (e.g., `totalGuest`, `bookingAmount` must be numbers).
- Validates constraints (e.g., `totalGuest` must be at least 1).
- Handled via a centralized validation middleware (`validate.ts`) that intercepts invalid requests before they reach the controllers.

### 5. Standardized Error Handling
- **App Errors**: Uses a custom error utility (`app.error.ts`) to throw standardized HTTP errors (e.g., `badRequest`, `notFound`, `conflict`, `internalServerError`).
- **Global Error Middleware**: A centralized `error.middleware.ts` catches all unhandled exceptions and format them into a consistent JSON response structure, preventing stack traces from leaking to the client in production.
- **Route Not Found**: A dedicated middleware (`route-not-found.middleware.ts`) gracefully handles 404 scenarios.

### 6. Structured and Rotating Logs
The application is equipped with a robust logging setup using `winston`:
- **Daily Rotation**: Logs are rotated daily using `winston-daily-rotate-file`, ensuring log files do not grow indefinitely and consume all disk space.
- **Actionable Logging**: Important lifecycle events (booking creation, idempotency key generation, confirmation, cancellation) are logged systematically in the repository layer to facilitate debugging and observability.

### 7. Correlation Tracking (Observability)
A `correlation.middleware.ts` is likely used to inject a unique correlation ID into every request. This ID can be attached to logs and responses, allowing developers to trace a single request's lifecycle across various services and log files in a microservices environment.

## Database Schema Highlights
The database consists of two primary models:
- **Booking**: Stores booking details including `userId`, `hotelId`, `bookingAmount`, `totalGuest`, and `bookingStatus` (`PENDING`, `CONFIRMED`, `CANCELLED`).
- **IdempotencyKey**: Stores the `idemKey` mapped uniquely to a `bookingId` and tracks its `finalised` state (boolean) to manage idempotency validations.

---
*Report generated automatically highlighting the technical achievements and capabilities of the Booking Service project.*
