---
name: ridersync-domain
description: Apply RiderSync architecture, product scope, and domain rules when planning, implementing, reviewing, or testing any RiderSync feature, API, database change, or interface.
---

# RiderSync — Domain and Architecture Skill

## 1. Purpose

Use this skill whenever work affects RiderSync product behavior, domain entities, API contracts, persistence, authorization, frontend flows, tests, or technical architecture.

The skill prevents domain drift and keeps implementation aligned with the decisions made for the RiderSync MVP. It supplements, but does not replace, the repository's `CLAUDE.md`, `README.md`, product/architecture documents, and implementation instructions.

## 2. Source-of-truth order

When instructions conflict, follow this order:

1. The user's most recent explicit decision in the active conversation.
2. The latest approved project implementation instructions in the repository.
3. The latest approved product/architecture document.
4. This skill.
5. Existing prototype behavior, which is reference material only.

Do not silently reconcile conflicting requirements. Identify the conflict and ask for a decision when it changes data ownership, permissions, lifecycle states, architecture, or MVP scope.

## 3. Fixed technical decisions

- Frontend: React + TypeScript + Vite, implemented as one responsive SPA for desktop and mobile.
- Backend: Node.js + TypeScript + NestJS.
- Backend architecture: one modular monolith, built and deployed as one backend application.
- Data: one PostgreSQL database for the MVP, accessed through Prisma ORM.
- Frontend/backend communication: documented REST API (Swagger/OpenAPI).
- Validation: Zod, integrated appropriately into the NestJS request-validation flow.
- Backend testing: Jest + Supertest.
- Local infrastructure: Docker Compose.
- Frontend routing, remote-data caching, and forms should follow the packages/decisions already approved in the repository. The current implementation plan names React Router, TanStack Query, and React Hook Form; do not replace them without a concrete reason and approval.

Do not introduce microservices, a second backend, Redis, queues, CQRS, event sourcing, or distributed infrastructure for the MVP. Do not switch to Next.js, Vue, Angular, or another frontend framework without explicit approval.

## 4. Current product scope

### 4.1 In-scope MVP capabilities

Prioritize these flows, completing them end to end:

1. Account registration and authentication.
2. Individual musician profile and public/private visibility.
3. Band identity, memberships, invitations, and roles.
4. Venue/space organization profile and its responsible members.
5. Public marketplace with musician/band discovery and essential filters.
6. Professional portfolio materials and validated external media links.
7. Independent technical riders for musician profiles and bands.
8. Venue equipment inventory.
9. Deterministic, explainable rider-versus-venue inventory comparison.
10. Venue event/opportunity publication and musician/band applications.
11. Direct booking proposals and booking negotiation initiated from a selected application.
12. Offers, counteroffers, and messages associated with a booking.
13. Basic dashboard, history, and confirmed-performance list only after core flows are stable.

### 4.2 Explicitly deferred: cultural opportunities and public calls (editais)

The entire editais/cultural-opportunities feature is postponed and is not part of the current MVP.

Until the user explicitly reactivates it:

- Do not implement cultural-opportunity catalogs, edital listings, public-call workflows, or funding-opportunity screens.
- Do not create `CulturalOpportunity` or `OpportunityRequirement` tables/models, API endpoints, controllers, services, migrations, frontend routes, navigation items, seed data, scraping, PDF extraction, or eligibility-comparison logic.
- Do not add edital-related tests or dashboard widgets.
- Do not reserve implementation time for editais in the active delivery plan.
- Existing references to editais in older documents are historical/deferred scope and must not override this decision.

If asked to change this area, confirm whether the user is reactivating the feature before implementing it. Do not infer that it has returned to scope from an old document alone.

### 4.3 Other exclusions

Unless the user changes scope, keep payment processing, custody or transfer of money, full producer/agency/festival personas, AI recommendations, intelligent equipment substitution, advanced rider optimization, advanced scheduling, and analytics beyond basic dashboard needs out of the MVP.

Ratings/reviews are visible in the prototypes but are not sufficiently specified as a complete product flow. Do not invent a complete review system; ask for a scope decision before adding review entities, moderation rules, or public rating calculations.

## 5. Domain rules that must be preserved

### 5.1 User and professional identities

- `User` represents an account/person, not a single global persona.
- Do not add a global `User.role = ARTIST | VENUE` model.
- `MusicianProfile` represents the person's individual professional identity and is separate from authentication credentials.
- A person may have an individual profile, participate in several bands, and administer one or more venues.
- Public endpoints must return only fields intended for public display. Never expose credentials, private email/contact details, private messages, or pending invitations through public profile queries.

### 5.2 Bands and memberships

- `Band` has its own identity, profile, portfolio, and technical rider. Do not automatically inherit or overwrite them from members' individual profiles.
- `BandMember` is the association between a user/person and a band; it carries membership state and a role.
- Initial band roles: `OWNER`, `ADMIN`, `MEMBER`.
- `OWNER` and `ADMIN` can perform the administrative actions defined by the product; `MEMBER` cannot perform administrative operations.
- Invitations must have explicit pending/accepted/declined behavior. A membership must not become active merely because an invitation was created.
- Prevent removal or demotion of the last active `OWNER` unless a valid owner transfer happens in the same consistent operation.

### 5.3 Venues and organizations

- `Organization` represents the contracting venue/space. For the current MVP, use the venue/space type only.
- `OrganizationMember` associates people with organizations.
- Initial venue roles: `OWNER` and `ADMIN`.
- Verify membership and role in the backend for every protected organization operation.
- Venue equipment inventory belongs to the venue organization, not to an artist or band.

### 5.4 Events, applications, and bookings

- `Event` is a venue-published opportunity for an artist/band to apply in the current MVP.
- Keep `organizerId` (the organization responsible for publication/selection) separate from optional `venueId` (the physical location). Do not assume they must always be the same concept.
- Suggested event states: `DRAFT`, `OPEN`, `CLOSED`, `COMPLETED`, `CANCELLED`. Validate transitions in the backend.
- `EventApplication` is an application to an event, not a booking or contract. Suggested states: `PENDING`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`.
- Prevent duplicate applications by the same artist identity to the same event, using a relational design that preserves referential integrity.
- Accepting an application does not automatically confirm a commercial agreement.
- `Booking` represents a negotiation/agreement process. It may start from a direct marketplace proposal or from a selected event application; both paths converge on the same booking workflow.
- `BookingOffer` preserves each proposal/counterproposal and its author, terms, timestamps, and response. Never overwrite prior offers to represent a counteroffer.
- `BookingMessage` belongs to a booking and is visible only to authorized participants.
- Confirming a booking is an explicit, authorized, auditable state transition.
- A confirmed booking is not proof that the performance occurred or that payment was made.
- Payments happen outside the platform; do not add payment processing or payment status flows.
- `Performance` represents a presentation that actually took place or was registered as performed; keep it distinct from an event, application, and booking.

### 5.5 Technical riders and compatibility

- Keep each musician's rider and each band's rider independent.
- `TechnicalRider` belongs to one professional artist identity (individual profile or band), and `RiderItem` records catalog item, required quantity, unit/category, and notes.
- `VenueEquipmentItem` records a venue's available catalog item and quantity. It is separate from rider data.
- Prefer stable catalog identifiers for comparable equipment. Do not compare only display strings and do not infer that different equipment types are substitutes.
- Run compatibility calculation on demand in a backend domain service. It must be deterministic and explainable.
- For a catalog item with explicit ID match:
  - `COMPATIBLE`: available quantity is greater than or equal to required quantity.
  - `PARTIALLY_AVAILABLE`: available quantity is greater than zero but below required quantity.
  - `UNAVAILABLE`: item is absent from the venue inventory or available quantity is zero.
- Custom/out-of-catalog items must not be auto-matched. Mark them for manual confirmation (for example, `NEEDS_CHECK`) and explain why.
- Return, per item, the needed quantity, available quantity where known, unit, status, and reason. Never present missing inventory data as confirmed compatibility.
- Do not create a generic compatibility engine. Keep this rule in the rider domain.

## 6. Data model decisions that remain open

Do not silently decide unresolved schema questions:

- Whether to introduce a common `Artist` entity to reference either `MusicianProfile` or `Band` across applications, bookings, and riders. Create it only if it genuinely reduces repeated domain logic and document the decision first.
- If a shared artist record is adopted, enforce that it refers to exactly one concrete subtype and preserve database-level referential integrity. Do not use an unchecked polymorphic `type + id` pair without foreign keys.
- Clarify invitation delivery/identity behavior before implementing beyond the currently approved flow.
- Confirm the minimal fields required before a musician/band profile can be public or submit an application.
- Do not add review/rating schema until the user approves the full workflow.

Before changing Prisma schema, explain the relational consequences, constraints, uniqueness, cascade behavior, and migration implications. Prefer explicit foreign keys and database constraints over relying only on frontend validation.

## 7. Frontend and prototype rules

- Rebuild the prototypes as React components. Do not ship the original standalone HTML files as the production application.
- Use `RiderSync celular.html` and `RiderSyncpc.html` as visual/interaction references, not as production data stores or architectural authority.
- Consolidate mobile and desktop into one responsive application. Do not maintain two separate frontends.
- Preserve the existing RiderSync visual language where appropriate: stage-case/equipment inspiration, yellow accent, dark header surfaces, clear type hierarchy, cards, filters, profiles, portfolios, rider and proposal interactions.
- Prioritize coherent responsive behavior, accessible forms, keyboard navigation, labels, focus states, loading, error, empty, and success states.
- Prototype localStorage data is fictional/demo data. Production reads and writes must go through the REST API and PostgreSQL. Never treat localStorage as the authoritative persistence layer for accounts, memberships, proposals, messages, or inventory.
- Do not copy prototype passwords, demo identities, fake ratings, seeded business records, or hard-coded prototype dates into production data.

## 8. Security and authorization

- Backend authorization is mandatory. Never rely on hidden buttons or client-supplied role values as security controls.
- For band actions, verify active membership and `OWNER`/`ADMIN` permissions as appropriate.
- For venue actions, verify the user's membership in the exact organization and the required organization role.
- For booking messages and offers, verify that the user is a participant in that booking.
- For public profile and marketplace queries, explicitly select public fields; do not serialize internal Prisma records wholesale.
- Validate and normalize all API input. Handle file uploads with type/size restrictions and non-public storage references where applicable.
- Keep secrets in environment variables. Never commit real `.env` files, tokens, or passwords.
- Do not store sensitive auth tokens in localStorage. Document the selected cookie/session or token strategy before implementing it.
- Do not expose stack traces, secrets, or private database details in API error responses.

## 9. Implementation workflow for Claude Code

For every task that changes more than a trivial isolated detail:

1. Inspect the existing repository, the current implementation, and relevant docs before editing.
2. Identify the affected domain module, user flow, API routes, Prisma relations, authorization checks, and tests.
3. Propose a concise implementation plan and list relevant assumptions.
4. Implement one vertical slice at a time: React UI, API/controller, application/domain logic, persistence, authorization, and tests as needed.
5. Reuse existing patterns and dependencies where sound. Avoid introducing packages or abstractions without demonstrated need.
6. Update schema through reviewed Prisma migrations; never reset or drop user data to bypass migration problems.
7. Run type checking, linting, related unit/integration tests, and production build where configured.
8. Use Playwright against the running app for critical user flows and responsive checks when the environment allows it.
9. Report precisely what changed, which commands/tests ran, what passed/failed, and what remains unverified.

Do not claim success based only on code generation or a screen rendering. Do not skip validation after schema, auth, permission, booking-state, or compatibility changes.

## 10. Required regression scenarios

When relevant to the change, test:

- Public visitor can browse public profiles but cannot access private account data.
- A user cannot edit another user's musician profile.
- Band roles enforce owner/admin/member boundaries.
- The final active band owner cannot be removed/demoted without a valid transfer.
- Venue members can only manage the organizations to which they belong.
- A band rider does not change when an individual member edits their own rider.
- Venue inventory does not modify artist/band rider contents.
- Rider comparison distinguishes compatible, partial, unavailable, and custom/manual-check items, including quantity edge cases.
- Duplicate applications are prevented.
- Accepting an application does not confirm a booking.
- Direct proposals and application-originated negotiations use the same booking lifecycle.
- Previous offers remain visible after counteroffers.
- Only booking participants can read/send booking messages and offers.
- A confirmed booking is not automatically marked as a performed show or paid.

Do not add edital/cultural-opportunity test cases while that feature remains deferred.

## 11. Definition of done

A feature is done only when:

- Its main user flow works end to end through React, the REST API, domain rules, and PostgreSQL.
- Input validation and backend authorization are implemented.
- Persistence and relevant database constraints are correct.
- Loading, error, empty, success, and permission-denied states are handled in the UI.
- Relevant tests are run and their results are reported.
- Type checking and build pass for the changed application areas, or failures are explicitly documented.
- Responsive behavior and accessibility basics are checked for user-facing screens.
- Relevant technical/product documentation is updated.

A screen, endpoint, or generated code fragment alone is not a complete feature.
