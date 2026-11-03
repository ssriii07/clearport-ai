CLEARPORT AI · MILESTONE 4 FRONTEND UPDATE

This ZIP contains a NEW frontend/ folder only. The existing backend and Git history remain untouched.

Steps on the user's Mac:
1. Download and unzip the update into ~/Downloads/clearport-ai.
2. Keep FastAPI running on http://127.0.0.1:8000 in its existing Terminal.
3. Open another Terminal window.
4. cd ~/Downloads/clearport-ai/frontend
5. node --version
6. npm --version
7. npm install
8. npm run typecheck
9. npm run dev
10. Open http://127.0.0.1:3000

Use demo executive or manager accounts already seeded by Milestone 2.
Do not commit until npm run build and manual browser testing pass.
The backend JWT stays in a Secure (production) / HTTP-only cookie managed by Next.js;
client-side code uses same-origin routes to proxy authenticated API requests.

Known limitations to address before public deployment:
- Run with current npm/Node dependencies and test build in the user's environment.
- In production use HTTPS, India-hosted backend + data, a provider contract prohibiting training, a stable signing secret and CSRF hardening.
- GEMINI_API_KEY remains backend-only; do not put it in frontend/.env.
- Source preview shows a useful fallback for seeded records without uploaded source files.
- No filing software's true Excel schema was supplied; CSV format is labelled as an assumption.
- AI confidence scores are self-reported and not calibrated; never claim 100% certainty.
