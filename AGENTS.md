# Gather Project Instructions

These instructions apply to all work in this repository and must be followed for every Gather development task.

## Canonical project and version history

- The only authorized active development directory is `C:\Users\inboxblake\development\CAL\gather-work`.
- The official GitHub repository and version history is `https://github.com/gitbbridge/gather`.
- The production website is `https://gatherforgood.bid`.
- Do not develop, edit, build for deployment, or deploy from `gather-production`, a temporary Sites checkout, or any other directory.
- Temporary or historical checkouts may be inspected for recovery, but they must never become independent development projects or deployment sources.
- Never silently switch branches, projects, directories, repositories, or deployment sources.

## Approved baseline and protected frontend

- Commit `584e8c4` is the approved marketing restoration baseline.
- The marketing homepage in `app/landing-page.tsx` and the About Give Holidays page in `app/about/give-holidays/page.tsx` are approved design assets.
- Preserve the approved pages' content, styling, layout, imagery, and navigation.
- Never redesign or modify either approved page unless the user explicitly requests changes to that page.
- Preserve all existing approved designs and application functionality.

## Change discipline

- Before editing, confirm the working directory, inspect the current Git branch and HEAD, and run `git status`.
- Preserve all existing uncommitted work. Do not overwrite, discard, stage, or commit unrelated user changes.
- Never modify onboarding or backend systems during a frontend-only task.
- Never introduce unrelated functionality or broad cleanup into a focused task.
- Make focused commits containing only completed, intended work.
- Never reset, force-push, rewrite history, or perform destructive Git operations without explicit user authorization.
- Never overwrite existing commits or newer work.

## Deployment controls

- Never deploy without the user's explicit approval for that deployment.
- Before every production deployment:
  1. Confirm the source directory is `C:\Users\inboxblake\development\CAL\gather-work`.
  2. Identify and report the exact Git commit proposed for deployment.
  3. Confirm the approved marketing homepage and About Give Holidays page are present.
  4. Run the production build and all relevant tests.
  5. Identify and report every failure, including failures known to be pre-existing.
  6. Verify that only intended changes are included in the proposed deployment.
  7. Obtain the user's explicit authorization to deploy.
- Every deployment must identify its source commit.
- After deployment, report the production version and exact Git commit deployed.

