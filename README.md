# Acheva Management

The management portal for universities on Acheva — **management.acheva.app**.

The DVC vets and approves the result sheets the Deans send; Exams & Records
file the approved sheets as the official record. Accounts are by invitation:
Acheva appoints the DVC and the head of Exams & Records, and the head adds the
rest of the team.

## Run it

```bash
npm ci
npm start          # http://localhost:4400, against the API in src/environments/environment.ts
```

## Build

```bash
npx ng build       # dist/acheva-management-WEB-UI
```

See `CLAUDE.md` for how it is put together.
