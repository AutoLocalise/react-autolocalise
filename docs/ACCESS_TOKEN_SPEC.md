# Access Token Authentication Specification

**Version:** 1.0.0  
**Target:** React Native SDK Implementation  
**Source:** React SDK (react-autolocalise)

---

## Overview

This specification describes the access token authentication feature for the AutoLocalise SDK. This feature enables secure, short-lived token-based authentication as an alternative to long-lived API keys, providing enhanced security through automatic token refresh and expiry handling.

---

## 1. Configuration

### 1.1 Authentication Methods

The SDK supports **two mutually exclusive** authentication methods:

| Method | Config Field | Description |
|--------|--------------|-------------|
| API Key | `apiKey: string` | Long-lived key (backward compatibility) |
| Access Token | `getAccessToken: () => Promise<AccessTokenResponse>` | Callback to fetch short-lived token |

**Validation Rules:**
- Exactly one method must be provided
- If `apiKey` is provided, it must be non-empty after trimming whitespace
- If `getAccessToken` is provided, it must be a function

### 1.2 Access Token Response

The `getAccessToken` callback must return an object with:

| Field | Type | Description |
|-------|------|-------------|
| `accessToken` | `string` | The JWT or opaque token string |
| `expiresAt` | `number \| string` | Either Unix timestamp (ms) or ISO 8601 date string |

**Behavior:** The SDK must accept both formats for `expiresAt` and convert to internal timestamp representation.

---

## 2. Token Lifecycle

### 2.1 Constants

| Constant | Value | Rationale |
|----------|-------|-----------|
| `TOKEN_EXPIRY_SAFETY_BUFFER_MS` | 60000 (60s) | Prevents requests failing due to token expiry during network transit |
| `MAX_RETRY_ATTEMPTS` | 1 | Limit retries after token refresh to avoid infinite loops |

### 2.2 Token Expiry Logic

A token is considered **expired** when:
1. No token has been fetched yet, OR
2. Current time >= (`tokenExpiryTime` - `TOKEN_EXPIRY_SAFETY_BUFFER_MS`)

**Why the safety buffer?** A token might expire between the expiry check and the actual API call. The 60-second buffer ensures the token is still valid when the request reaches the server.

### 2.3 Token Refresh Triggers

The `getAccessToken` callback is invoked when:

| Trigger | Condition | Behavior |
|---------|-----------|----------|
| SDK Initialization | No valid token exists | Block initialization until token fetched |
| Proactive Refresh | Within 60s of expiry | Refresh before actual expiry |
| Server Error | API returns 401/403 with `token_expired` | Refresh and retry the failed request |

---

## 3. Request Flow

### 3.1 Authentication Method Selection

```
┌─────────────────────────────────────────────────────────────┐
│                    API Request Flow                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Check authentication method                             │
│     ├─ apiKey configured → include apiKey in request        │
│     └─ getAccessToken configured → check token state        │
│                                                             │
│  2. If using access token:                                  │
│     ├─ Token expired? → Queue request, fetch token first    │
│     └─ Token valid? → Include accessToken in request        │
│                                                             │
│  3. Make API call                                           │
│                                                             │
│  4. Handle response:                                        │
│     ├─ Success → Return response                            │
│     ├─ 401/403 + token_expired → Refresh token, retry once  │
│     └─ Other error → Log error, return null                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Concurrent Request Handling

When multiple API calls occur during token refresh:

```
Timeline:
─────────────────────────────────────────────────────────>
    
Request A ──┐
Request B ──┼──► [QUEUED] ──► [Token Refresh] ──► [Process Queue]
Request C ──┘        │                              │
                     │                              ├─► Execute A
                     │                              ├─► Execute B
                     │                              └─► Execute C
                     └─ All wait for same token
```

**Behavior:**
- First request triggers token refresh
- Subsequent requests queue and wait
- After token fetched, all queued requests execute in parallel
- If token fetch fails, all queued requests are rejected

### 3.3 Retry Logic

```
┌────────────────────────────────────────────────────────────┐
│                   Token Expired Error Flow                 │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  API returns 401/403 with token_expired error             │
│           │                                                │
│           ▼                                                │
│  Is refresh already in progress?                           │
│     ├─ Yes → Queue this request (increment retry count)   │
│     └─ No  → Initiate refresh, then retry request         │
│                                                            │
│  Retry count >= MAX_RETRY_ATTEMPTS?                        │
│     ├─ Yes → Log error, return null                       │
│     └─ No  → Continue with retry                          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 4. State Management

### 4.1 Required Internal State

The SDK must track:

| State | Purpose |
|-------|---------|
| Current access token | Include in API requests |
| Token expiry time | Determine when to refresh |
| Refresh-in-progress flag | Prevent concurrent refresh attempts |
| Pending request queue | Hold requests during refresh |

### 4.2 State Transitions

```
                    ┌──────────────┐
                    │  No Token    │
                    └──────┬───────┘
                           │ fetchAccessToken()
                           ▼
                    ┌──────────────┐
         ┌─────────│ Valid Token  │◄─────────┐
         │         └──────┬───────┘          │
         │                │                  │
    expires or            │            token refresh
    401 error             │                  │
         │                ▼                  │
         │         ┌──────────────┐          │
         └────────►│  Expired     │──────────┘
                   └──────────────┘
```

---

## 5. Initialization Flow

```
┌────────────────────────────────────────────────────────────┐
│                    SDK Initialization                      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  1. Validate configuration                                 │
│     └─ Must have exactly one: apiKey OR getAccessToken    │
│                                                            │
│  2. If using access token AND token expired/missing:      │
│     └─ Fetch token BEFORE any other operations            │
│                                                            │
│  3. Load cached translations                               │
│                                                            │
│  4. Fetch existing translations from API                   │
│                                                            │
│  5. Mark as initialized                                    │
│                                                            │
│  Error Handling:                                           │
│  - Token fetch failure → Log error, still mark initialized │
│  - Reason: Don't block app startup                        │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 6. Error Handling

### 6.1 Error Types

| Error | When Raised | Behavior |
|-------|-------------|----------|
| `ConfigurationError` | Invalid config (missing/both auth methods, empty apiKey) | Throw immediately |
| `AccessTokenError` | Token fetch fails | Wrap original error, reject queued requests |

### 6.2 Error Handling Principles

1. **Never throw on token fetch failure during runtime** → Log and return null
2. **Never crash the host application** → Graceful degradation
3. **Log all errors** → For debugging
4. **Reject all queued requests on fatal token error** → Clean state

---

## 7. API Contract

### 7.1 Request Fields

**Translation Request** (`POST /v1/translate`):

| Field | Required | Notes |
|-------|----------|-------|
| `texts[]` | Yes | Array of text objects to translate |
| `sourceLocale` | Yes | Source language code |
| `targetLocale` | Yes | Target language code |
| `apiKey` | Conditional | Required if using API key auth |
| `accessToken` | Conditional | Required if using token auth |
| `version` | Yes | SDK version string |

**Get Translations Request** (`POST /v1/translations`):

| Field | Required | Notes |
|-------|----------|-------|
| `targetLocale` | Yes | Target language code |
| `lastRefreshTime` | No | Timestamp for incremental sync |
| `apiKey` | Conditional | Required if using API key auth |
| `accessToken` | Conditional | Required if using token auth |

### 7.2 Server Error Response

When token expires, server returns:
- HTTP Status: `401` or `403`
- Body: `{ "error": "token_expired" }` OR `{ "code": "token_expired" }`

SDK must check both `error` and `code` fields.

---

## 8. Usage Examples

### 8.1 Backend Token Endpoint (User Implementation)

User must provide a backend endpoint that:
1. Receives request from client
2. Calls AutoLocalise API with their API key
3. Returns token to client

```
Client                    User Backend              AutoLocalise API
  │                            │                          │
  │  GET /api/token            │                          │
  │───────────────────────────►│                          │
  │                            │  POST /auth-token        │
  │                            │  Header: x-api-key       │
  │                            │─────────────────────────►│
  │                            │                          │
  │                            │  { accessToken, expiresAt}
  │                            │◄─────────────────────────│
  │  { accessToken, expiresAt} │                          │
  │◄───────────────────────────│                          │
```

### 8.2 React Native SDK Usage

**With Access Token:**
```typescript
const config = {
  getAccessToken: async () => {
    const res = await fetch('/api/autolocalise-token');
    return res.json();
  },
  sourceLocale: 'en',
  targetLocale: 'es',
};
```

**With API Key (backward compatible):**
```typescript
const config = {
  apiKey: 'your-api-key',
  sourceLocale: 'en',
  targetLocale: 'es',
};
```

---

## 9. Testing Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| Init with no token | Fetch token before other operations |
| Init with valid token | Skip token fetch, proceed normally |
| Proactive refresh | Refresh when within 60s of expiry |
| Concurrent requests during refresh | Queue all, execute after token ready |
| 401 token_expired response | Refresh token, retry request once |
| Token fetch failure | Log error, reject queued requests, don't crash |
| Both apiKey and getAccessToken provided | Throw ConfigurationError |
| Neither apiKey nor getAccessToken | Throw ConfigurationError |
| Empty/whitespace apiKey | Throw ConfigurationError |
| expiresAt as ISO string | Parse correctly to timestamp |
| expiresAt as Unix timestamp | Use directly |

---

## 10. Security Considerations

| Consideration | Implementation |
|---------------|----------------|
| Short-lived tokens | Server enforces expiry (e.g., 1 hour) |
| API key protection | Never include API key in client code; use backend token endpoint |
| Automatic refresh | SDK handles refresh transparently |
| Token storage | Memory only — never persist to disk/cache |
| Graceful degradation | Failed auth doesn't crash app |

---

## 11. Implementation Checklist

- [ ] Configuration validation for mutually exclusive auth methods
- [ ] Token state tracking (current token, expiry, refresh flag)
- [ ] Token expiry check with safety buffer
- [ ] Token fetch via callback
- [ ] Request queuing during refresh
- [ ] Queue processing after token ready
- [ ] 401/403 token_expired error handling
- [ ] Retry logic with MAX_RETRY_ATTEMPTS limit
- [ ] Error types (ConfigurationError, AccessTokenError)
- [ ] Include accessToken in API requests
- [ ] Initialization fetches token before other operations
- [ ] Unit tests for all scenarios

---

*End of Specification*