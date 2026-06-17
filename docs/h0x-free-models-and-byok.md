# H-0x Free Models And BYOK

H-0x should keep Pi-compatible model access as-is. Users may use any free or default model route that their local Pi/H-0x install can already discover through `h0x --list-models`.

Users can also configure their own provider keys with BYOK:

```bash
h0x provider add openrouter --api-key <key> --model <model>
h0x provider add openai --api-key <key> --model <model>
h0x provider list
```

Do not embed shared provider tokens in the desktop or CLI install. If H-0x provides free usage for users, keep owner-funded credentials behind a server-side gateway with authentication, quotas, abuse limits, token masking, and audit logs. Client installs should receive only short-lived routed access, never the raw shared provider key.

