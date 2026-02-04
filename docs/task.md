# Task: Re-implement CRM Reception with Excel Template Fidelity

- [x] Planning & Research
    - [x] Analyze current `excel_logic.py` for template deformation bugs.
    - [x] Research `api-geofal-crm` for XML manipulation rules.
    - [x] Update Implementation Plan with Scratch Rewrite & Label-Based Mapping.
- [/] Backend Implementation (Scratch Rewrite)
    - [ ] Create new `excel_logic_v2.py` with robust XML utilities.
    - [ ] Implement Label-Based Anchor Detection (Fidelity Lock).
    - [ ] Implement Row Shifting & Duplication logic based on sample count.
    - [ ] Correct A-K Mapping and Footer mapping.
    - [ ] Replace old `excel_logic.py` with the new version.
- [ ] Frontend Implementation & Form Refinement
    - [ ] Update `OrdenForm.tsx` fields to match A-K mapping.
    - [ ] Verify Iframe `CLOSE_MODAL` message logic.
- [ ] Verification & Testing
    - [ ] Create automated fidelity verification script.
    - [ ] Perform manual Excel export tests (small and large data sets).
    - [ ] Create `walkthrough.md` with proof of work.
