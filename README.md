# Qeilvra

Production-oriented snooker club POS and management software built with Next.js, TypeScript, Tailwind CSS and Supabase.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and add the Supabase project values.
3. Apply the SQL files in `supabase/migrations` in filename order.
4. In development, run `supabase/seed.sql`, create the first Auth user, then insert its owner profile as described in `supabase/README.md`.
5. Start with `npm run dev`.

The service-role key is used only by trusted server actions for staff account administration. It must never use a `NEXT_PUBLIC_` prefix.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Security model

All business records carry a `club_id`. Row Level Security resolves club membership from the signed-in user profile rather than trusting client input. Session start/end, checkout, inventory adjustment and refunds run as transactional database functions so table state, payments, stock and audit logs cannot be partially updated.
