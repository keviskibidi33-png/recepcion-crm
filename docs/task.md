# Task: Re-implement CRM Reception with Excel Template Fidelity

- [x] Planning & Research
    - [x] Analyze current `excel_logic.py` for template deformation bugs.
    - [x] Research `api-geofal-crm` for XML manipulation rules.
    - [x] Update Implementation Plan with Scratch Rewrite & Label-Based Mapping.
- [x] Backend Implementation (Scratch Rewrite)
    - [x] Create new `excel_logic_v2.py` (implemented as `excel_logic.py`).
    - [x] Implement Label-Based Anchor Detection (Fidelity Lock).
    - [x] Implement Row Shifting & Duplication logic based on sample count.
    - [x] Correct A-K Mapping and Footer mapping.
    - [x] Replace old `excel_logic.py` with the new version.
- [x] Frontend Implementation & Form Refinement
    - [x] Update `OrdenForm.tsx` fields to match A-K mapping.
    - [x] Verify Iframe `CLOSE_MODAL` message logic.
- [/] Verification & Testing
    - [x] Create automated fidelity verification script.
    - [x] Perform manual Excel export tests (small and large data sets).
    - [ ] Create `walkthrough.md` with proof of work.
