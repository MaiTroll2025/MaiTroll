# ESLint Warnings

Status: partially resolved.

The warning list in this document was a snapshot of the backlog, not the current state of the project. The relevant pet and seat-lock fixes were completed and verified.

## Verified clean on the current fixes

Command:
`Set-Location -LiteralPath 'c:\Users\kainm\TC ONLY\TrollCity'; npx eslint --quiet src/components/pets/PetShelterPanel.tsx src/hooks/useStreamSeats.ts src/pages/broadcast/ViewerPage.tsx src/phone/pages/PhoneViewerPage.tsx`

Result:
- Exit code: 0
- No lint errors in the updated files

## Notes

The wider mobile/desktop lint backlog still contains many legacy warnings across unrelated files, especially in phone pages and large broadcast components. Those are separate from the pet economy and seat-lock fixes implemented here.

The active work items are tracked through the actual code changes, not by this historical warning dump.
