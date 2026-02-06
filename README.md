# Vizi Reminders

## What is this?

Vizi Reminders is an external module for the VIZI.hr platform.
It allows business owners (such as salons, barbers, therapists) to enter client appointments and automatically send reminder emails before the appointment.

This project is intentionally built as a standalone application and is NOT part of the main VIZI core codebase.

## How it is used (from a user perspective)

- The business owner logs into VIZI.hr
- If the user has an active PRO plan, they can access the Reminders module
- The user manually enters appointments (date, time, client name, client email)
- The system automatically sends a reminder email one day before the appointment
- The business owner does not need to manually send messages

## Relationship with VIZI core

**VIZI core is responsible for:**

- Authentication
- Subscription plans and billing
- PRO access control
- User identity

**Vizi Reminders is responsible for:**

- Appointments
- Scheduled reminder sending
- Email delivery
- Message logging

VIZI core does not send emails and does not manage appointments.

## Intentional MVP limitations

This module intentionally does NOT include:

- Online booking
- Client self-confirmation
- Payments
- Public calendars
- Google Calendar sync
- SMS sending

These limitations are intentional to keep the MVP simple, reliable, and easy to maintain.
