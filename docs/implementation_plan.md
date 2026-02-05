# Redo CRM Reception with Excel Template Fidelity (Scratch Rewrite)

The goal is to rebuild the backend Excel generation logic from scratch to ensure 100% template fidelity. The previous implementation had bugs causing text duplication and template deformation. We will implement a "Label-Based Mapping" strategy to dynamically locate data fields based on template labels, preventing issues caused by row shifting.

## Proposed Changes

### Backend (recepcion-crm/backend)

#### [MODIFY] [excel_logic.py](file:///c:/Users/Lenovo/Documents/crmnew/recepcion-crm/backend/excel_logic.py)
A complete rewrite of the Excel generation logic using direct XML manipulation (`lxml`) with the following improvements:
- **Robust Label Anchoring**: Dynamically find rows for "N° Recepción", "OT", "Cliente", etc.
- **Surgical Column Offsets**: 
    - For labels in Column A/B (e.g., "RECEPCIÓN N°:"), data is written to **Column D** to prevent overlap.
    - For labels in Column I/G (e.g., "OT N°:", "Teléfono :"), data is written to **Column J/H**.
- **Missing Fields Mapping**: Added mapping for Persona Contacto, Email, Teléfono, Solicitante, Domicilio Solicitante, and Ubicación.
- **Improved Row Shifting/Duplication**: Cleaner implementation of row cloning. We will shift the entire footer block down once based on the number of samples exceeding the initial bounded area (threshold: 18 rows).
- **SharedString Management**: Proper reconstruction of the `sharedStrings.xml` table to ensure no duplication and clean strings.

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
- **Nota**: Observaciones (Label: "Nota:") mapped to Column D.
- **Checkboxes**: Fisica (A52), Digital (A54) relative to the shifted Note row.
- **Signatures**: Entregado por (B56) and Recibido por (G56) relative to anchors.

## Verification Plan

### Automated Tests
- `diag_surgical.py`: Verifies anchor neighbors and absolute data placement.
- `diag_final_dump.py`: Visual dump of Rows 6-20 to confirm zero overlap and 100% mapping.

### Manual Verification
- Visual inspection of the exported file with 1, 5, and 25 samples.
- Verify surgical alignment of headers (Col D for labels in A/B).
- Verify iframe `CLOSE_MODAL` message works and refreshes the list in the parent window.
