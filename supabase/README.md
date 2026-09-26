# Supabase setup

1. Create a Supabase project and copy `.env.example` to `.env.local`.
2. Run migrations in filename order with the Supabase CLI (`supabase db push`) or SQL editor.
3. Create the first Auth user in the Supabase dashboard.
4. Insert its club profile using the Auth user UUID:

```sql
insert into public.profiles(auth_user_id, club_id, full_name, email, role)
values ('AUTH_USER_UUID', '11111111-1111-4111-8111-111111111111', 'Club Owner', 'owner@example.com', 'owner');
```

5. Run `seed.sql` only in development.

Staff account creation should be performed from a trusted server using the service-role key. Never expose that key to the browser.
