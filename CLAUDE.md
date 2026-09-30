# Campus Connect Plan

## Project

Build Campus Connect, a real-time campus social network, one feature at a time.
Wait for the user's go-ahead before starting each next feature.

## Stack

- Client: React with Vite and Tailwind CSS
- Server: local Node.js API with Express and Socket.IO
- Storage: shared server-managed Excel workbook (`Book2.xlsx`)
- Passwords: PBKDF2 password hashes stored in the workbook
- Email OTP and payment collection are unavailable without mail and payment services

## Planned Features

1. College-domain signup and login; allowed email domains are configured on the server.
2. Clubs: create, browse, request membership, and creator approval.
3. Events: create, browse, and book seats for attendees and guests; free and priced events are supported, but payment is not collected.
4. Club members, organizers, committee members, event participants, campus contacts, and live college announcements.

## Project Structure

- `client/src/pages`
- `client/src/components`
- `client/src/context`
- `client/src/api`
- `server/controllers`
- `server/middleware`
- `server/routes`
- `server/utils`

## Working Rules

- Use ES modules and readable, simple async/await code.
- Validate all inputs and never hardcode secrets; keep configuration in environment variables.
- Save all records to the shared workbook; never store plain-text passwords.
- Run one server on the campus network; clients connect through its local API and Socket.IO rooms.
- After each feature, explain how to test it and what each changed file does.
- Keep this plan aligned with user-approved changes.