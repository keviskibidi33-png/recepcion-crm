# Redo CRM Reception with Excel Template Fidelity (Scratch Rewrite)

The goal is to rebuild the backend Excel generation logic from scratch to ensure 100% template fidelity. The previous implementation had bugs causing text duplication and template deformation. We will implement a "Label-Based Mapping" strategy to dynamically locate data fields based on template labels, preventing issues caused by row shifting.

## Proposed Changes

### Backend (recepcion-crm/backend)

#### [MODIFY] [excel_logic.py](file:///c:/Users/Lenovo/Documents/crmnew/recepcion-crm/backend/excel_logic.py)
A complete rewrite of the Excel generation logic using direct XML manipulation (`lxml`) with the following improvements:
- **Robust Label Anchoring**: Dynamically find rows for "N° Recepción", "OT", "Cliente", etc., and use their neighbors.
- **Improved Row Shifting/Duplication**: Cleaner implementation of row cloning. We will shift the entire footer block down once based on the number of samples exceeding the initial bounded area.
- **SharedString Management**: Proper reconstruction of the `sharedStrings.xml` table to ensure no duplication and clean strings.
- **Mapping Fidelity**: Ensuring columns A-K (excluding D if empty) and footer sections match the template exactly.

| Column | Field |
| --- | --- |
| A | Item (Index + 1) |
| B | Código LEM |
| C | *Merged/Empty* |
| D | Identificación muestra (Description) |
| E | Estructura |
| F | f'c |
| G | Fecha moldeo |
| H | Hora |
| I | Edad |
| J | Fecha rotura |
| K | Requiere densidad (SI/NO) |

### Footer Mapping
- **Nota**: Observaciones (Label: "Nota:")
- **Emisión Física**: Checkboxes in Column A (Label: "Digital:" / "Fisica:")
- **Signatures**: Entregado por (Label: "ENTREGADO POR:") and Recibido por (Label: "RECIBIDO POR:")

## Verification Plan

### Automated Tests
- Create `verify_fidelity_v2.py`:
  - Triggers Excel generation.
  - Verifies that labels are NOT overwritten.
  - Verifies that data is in correct relative positions to labels.

### Manual Verification
- Visual inspection of the exported file with 1, 5, and 25 samples.
- Verify iframe `CLOSE_MODAL` message works and refreshes the list in the parent window.

