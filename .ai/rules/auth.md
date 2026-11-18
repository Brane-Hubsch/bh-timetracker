---
paths:
  - 'app/Actions/Auth/**'
---

# Auth

## Passwordless only; passwords are a dev convenience
Users sign in with passkeys, Google or magic links. Never require or depend on a password: password login exists only when SignInOptions::passwordLogin() (local/testing, never production). Magic links are single-use, store only a SHA-256 token hash and are consumed on POST.
