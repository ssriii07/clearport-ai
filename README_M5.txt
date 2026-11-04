ClearPort AI — MILESTONE 5 QUALITY UPDATE (part 1)

This ZIP is an UPDATE for your existing ~/Downloads/clearport-ai folder.
Do NOT unzip into a new project or run git init again. Your four existing commits remain unchanged.

1. In the Terminal windows running uvicorn and Next.js, press Control+C to stop the servers.
2. Download the update ZIP to Downloads.
3. From any Terminal, run:

   cd ~/Downloads/clearport-ai
   unzip -o ~/Downloads/clearport-ai-milestone-05-quality-update.zip -d ~/Downloads/clearport-ai

4. Run the backend tests with your existing environment:

   cd ~/Downloads/clearport-ai/backend
   source ../.venv/bin/activate
   python -m pytest -q

Expected: 39 passed. DO NOT re-seed or delete your local SQLite database.

5. Verify frontend TypeScript and production build:

   cd ~/Downloads/clearport-ai/frontend
   npm run typecheck
   npm run build
   npm audit

Expected: no errors; npm audit 0 vulnerabilities if your previous patched PostCSS override is retained.
DO NOT use `npm audit fix --force`.

Do not commit M5 until after these tests and a short browser sanity check.

Important changes:
- Missing original file => source-based confirmation is blocked, by the backend too.
- Viewing an original file creates an access audit event.
- AI scores display as *self-scores*, not accuracy percentages.
- The system now flags invoice buyer != shipment importer and packing list invoice reference != invoice.
- SHP-24811 may show a SECOND conflict in addition to the deliberate gross-weight mismatch.
- Read docs/M5_QUALITY_NOTES.md for limitations, assumptions and remaining review tasks.

No secrets, database files, node_modules, or Gemini key are included in this ZIP.
