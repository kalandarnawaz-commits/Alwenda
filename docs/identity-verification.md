# Alwenda Identity Verification Foundation

Alwenda should not pay for government ID checks for every account. The current product should use a staged trust model:

1. Email verification
2. Phone verification
3. Provider/business proof when a user sells, accepts jobs, or claims a business
4. Government ID verification only for higher-risk use cases

The frontend now contains a Persona-ready placeholder in `src/services/identity/personaVerification.js`. It does not call Persona and does not mark a user as ID verified. It only prepares the profile UX and record shape needed for a future server-side provider connection.

## Future Persona Integration

Connect Persona through Supabase Edge Functions, not directly from browser JavaScript.

Required server-side pieces:

- `PERSONA_API_KEY` stored as a Supabase secret
- Persona template ID stored as a Supabase secret or private config
- Edge Function to create a Persona inquiry for the authenticated user
- Persona webhook endpoint to receive status changes
- RLS-protected `identity_verifications` table
- No raw ID images stored in Alwenda tables or browser storage

Recommended public record shape:

```json
{
  "user_id": "auth.uid()",
  "provider": "persona",
  "provider_reference": "inq_...",
  "status": "pending_provider | verified | rejected",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

Do not award the public “Identity verified” badge until the webhook confirms a successful provider result.
