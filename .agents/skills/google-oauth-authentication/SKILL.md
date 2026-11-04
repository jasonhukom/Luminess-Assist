---
name: google-oauth-authentication
description: Investigate and repair Google OAuth login, loopback callback listener, token exchange, token refresh, session persistence, and Google account synchronization.
---

# Google OAuth Authentication Skill (`google-oauth-authentication`)

## Overview
Repairs and maintains Google Sign-In for Luminess Assist desktop companion.

## Key Implementation Details
1. **Valid Installed-App OAuth Client Credentials**:
   - Ensures `getOAuthClientConfig()` always resolves a valid installed-application Google OAuth `clientId` and `clientSecret` (supporting environment overrides, custom `config.json` OAuth credentials, and the standard installed-app Google OAuth client).
2. **Loopback OAuth Callback (`start_google_oauth_login`)**:
   - Binds `127.0.0.1:0` in Rust, opens the system browser to `https://accounts.google.com/o/oauth2/v2/auth`, captures the authorization `code`, and exchanges it at `https://oauth2.googleapis.com/token`.
3. **Session Persistence & Auto-Refresh**:
   - Persists the OAuth session (`accessToken`, `refreshToken`, `expiryDate`, `email`, `name`, `picture`) in the machine vault so the user stays signed in across app restarts.
   - Automatically refreshes expiring access tokens using the stored `refreshToken`.
4. **Account Synchronization**:
   - Associates persistent user memories, profile facts, and conversation history with the authenticated Google account (`email`).
