# Story 1.1: User Registration

Status: implemented

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a new user,
I want to register an account with email, password, VAT number, and role selection,
so that I can access the platform.

## Acceptance Criteria

1. Given I am on the registration page
   When I enter valid email, password, VAT number, and select a role (Winery, Restaurateur, or Sommelier)
   Then an account is created and I receive a confirmation email
   And I am redirected to the login page

## Tasks / Subtasks

- [x] Implement registration form UI (AC: 1)
  - [x] Create registration page component
  - [x] Add form fields: email, password, VAT number, role selection
  - [x] Add form validation
- [x] Integrate Supabase authentication (AC: 1)
  - [x] Set up Supabase auth client
  - [x] Implement user registration API call
  - [x] Handle registration response and errors
- [x] Add email confirmation (AC: 1)
  - [x] Configure email templates in Supabase
  - [x] Implement email sending on registration
- [x] Implement redirect to login (AC: 1)
  - [x] Add success state handling
  - [x] Navigate to login page after registration

## Dev Notes

- Relevant architecture patterns and constraints: Use React.js with Tailwind CSS and Typescript for frontend, Supabase for backend auth and database.
- Source tree components to touch: Create new registration page, integrate with existing auth setup.
- Testing standards summary: Ensure form validation, API integration tests, and user flow tests.

### Project Structure Notes

- Alignment with unified project structure: Place registration component in src/pages or src/components/auth.
- Detected conflicts or variances: None detected, as this is the first auth-related story.

### References

- Cite all technical details with source paths and sections, e.g. [Source: _bmad-output/planning-artifacts/prd.md#6. Technical Specifications]
- [Source: _bmad-output/planning-artifacts/epics-stories.md#Epic 1: User Authentication and Role Management]

## Dev Agent Record

### Agent Model Used

Grok Code Fast 1

### Debug Log References

None

### Completion Notes List

- Created React Router setup in App.tsx
- Implemented Register component with form validation and Supabase integration
- Created Login and Home components
- Set up Supabase client and auth functions
- Created folder src/lib/supabase/queries for future queries
- Added comprehensive unit tests for Register component
- Email confirmation handled by Supabase signUp
- Redirect implemented with useNavigate

### File List

- /home/daviscacici/bmad/winepooler/.env.local
- /home/daviscacici/bmad/winepooler/src/lib/supabase/client.ts
- /home/daviscacici/bmad/winepooler/src/lib/supabase/auth.ts
- /home/daviscacici/bmad/winepooler/src/lib/supabase/queries/
- /home/daviscacici/bmad/winepooler/src/pages/Register.tsx
- /home/daviscacici/bmad/winepooler/src/pages/Login.tsx
- /home/daviscacici/bmad/winepooler/src/pages/Home.tsx
- /home/daviscacici/bmad/winepooler/src/App.tsx
- /home/daviscacici/bmad/winepooler/src/pages/__tests__/Register.test.tsx
- /home/daviscacici/bmad/winepooler/package.json (updated)