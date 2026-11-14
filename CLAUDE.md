# acheva-management-WEB-UI — Management Portal

Angular 20 · standalone · signals · zoneless · SCSS · `npm start` → http://localhost:4400
Deployed at **management.acheva.app**. API base: `src/environments/environment.ts` → `BASE_URL`.

Where a university's **DVC** (one unique login) and **Exams & Records** (a
team) sign in — the user's design of 2026-11-13; "any other important staff"
will join later. Scaffolded from `acheva-admin-WEB-UI`'s shell; shares no code
with it at runtime.

## Who signs in, and how

- Accounts are **invite-only**. Acheva invites the DVC and the head of Exams &
  Records from the admin console (`/management` there); the head invites the
  rest of the team from **Team** here. `/register?token=&email=` shows what the
  invite is for, asks for a name and password, and signs them straight in.
- Session in localStorage: `acheva-mgmt-token`, `acheva-mgmt-refresh`,
  `acheva-mgmt-account`. **The refresh token is kept and used**
  (`AuthService.renew`, one renewal at a time; `error.interceptor` retries
  once on 401, then signs out). The admin console throws its refresh token
  away; this app must not, or the DVC is signed out every day.
- `AuthService.refreshAccount()` re-reads `/auth/management/me` when the shell
  loads, so a changed office or head flag shows without signing out.
- The server re-reads the account on every request: a deactivated member is
  signed out on their next click.

## Pages

| Path | Who | What |
|---|---|---|
| `/dashboard` | all | Counts per box, the sheets waiting longest |
| `/results` | DVC: To review · Returned to the Dean · Approved · All. Exams & Records: To file · Filed · All | Filters (faculty, department, session, semester, kind) and search (reg. no., name, department) live in the address bar. The DVC can tick several in To review and approve them together |
| `/results/:id` | all | The sheet as the paper lays it out, Download PDF, the trail; DVC: Approve (optional note) / Return to the Dean (reason required); Exams & Records: Mark as filed (optional note: where it is kept) |
| `/team` | head of Exams & Records only | Invite a member (link to copy), switch members off and on, withdraw pending invites |

Notifications: the header bell polls `/notifications`; a notice with
`meta.submissionId` opens that sheet.

## The sheet — shared with the staff portal

`core/models/sheet.model.ts`, `core/sheet-format.ts` (+ spec),
`shared/sheet-view.ts`, `shared/sheet-pdf.ts` (+ spec) and
`shared/sheet-export.service.ts` have **hand-kept copies in
`Acheva-WEB-UI/src/app/@features/dvc-results/`. Change one, change both.**

- Every figure comes from the server (`acheva-nestjs/src/result-submissions`)
  and was frozen when the HOD sent the sheet. Nothing is computed here.
- The PDF is A4 landscape, laid out like FUTO's paper: IG n top right, the
  header, DEPT/YEAR and SEMESTER/SESSION, course codes standing on end over
  their units, CURRENT/PREVIOUS/CUMMULATIVE, REMARK, then the sign lines filled
  with who signed and when (dotted where nobody has). **pdfmake cannot rotate
  text**: `SheetExportService.codeImage` draws each code on a canvas.
- **Never give a table the class `grid`** — Tailwind's `.grid` makes it
  `display: grid` and the body stops lining up with the header.

## House rules

Brand blue only (`#2793FF`, `#77BBFF` and tints — no green), nothing heavier
than weight 500. Global building blocks are `mg-` classes in `src/styles.scss`.
Dates are day first (`formatDate`), never the runtime's locale.

## Commands

```
npm start                                        # ng serve, port 4400
npx ng build                                     # production build (budgets)
npx ng test --watch=false --browsers=ChromeHeadless   # 11 specs
```

End to end: `npm run test:dvc-chain-ui` in `Acheva-WEB-UI` drives this app with
the admin console and the staff portal against the test API.
