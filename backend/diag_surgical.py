from excel_logic import ExcelLogic
from models import RecepcionMuestra, MuestraConcreto
from datetime import datetime
import os
import zipfile
from lxml import etree

NAMESPACES = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def get_xml_content(file_path):
    with zipfile.ZipFile(file_path, 'r') as z:
        sheet = z.read('xl/worksheets/sheet1.xml')
        strings = z.read('xl/sharedStrings.xml')
        return etree.fromstring(sheet), etree.fromstring(strings)

def get_shared_strings(ss_root):
    ns = ss_root.nsmap.get(None, NAMESPACES['main'])
    strings = []
    for si in ss_root.findall(f'{{{ns}}}si'):
        t = si.find(f'{{{ns}}}t')
        if t is not None: strings.append((t.text or "").strip())
        else: strings.append(''.join([x.text or '' for x in si.findall(f'.//{{{ns}}}t')]).strip())
    return strings

def get_cell_value(sheet_root, strings, ref):
    ns = sheet_root.nsmap.get(None, NAMESPACES['main'])
    cell = sheet_root.find(f'.//{{{ns}}}c[@r="{ref}"]')
    if cell is None: return "NOT_FOUND"
    t = cell.get('t')
    v = cell.find(f'{{{ns}}}v')
    if v is None: return "EMPTY"
    print(f"DEBUG {ref}: t={t}, v={v.text}")
    if t == 's':
        idx = int(v.text)
        return strings[idx] if idx < len(strings) else f"ERR_IDX_{idx}"
    return v.text

def verify_surgical():
    template_path = 'c:/Users/Lenovo/Documents/crmnew/recepcion-crm/templates/recepcion_template.xlsx'
    logic = ExcelLogic(template_path)
    
    # Mock Data (25 samples to force shift)
    muestras = [
        MuestraConcreto(
            item_numero=i,
            codigo_muestra_lem=f"LEM-{100+i}",
            identificacion_muestra=f"ID-{i}",
            estructura=f"COL-{i}",
            fc_kg_cm2=210.0,
            fecha_moldeo="01/01/2026",
            hora_moldeo="08:00",
            edad=7,
            fecha_rotura="08/01/2026",
            requiere_densidad=True
        ) for i in range(1, 26)
    ]
    
    recepcion = RecepcionMuestra(
        numero_recepcion="SURGICAL-001",
        numero_cotizacion="COT-123",
        numero_ot="OT-999",
        cliente="TOTAL QUALITY CORP",
        domicilio_legal="AV. SURGICAL 123",
        ruc="20555555555",
        persona_contacto="ING. MARIO BENAVENTE",
        email="mario@totalquality.com",
        telefono="999-111-222",
        solicitante="CONSTRUCTORA ALPHA S.A.",
        domicilio_solicitante="CALLE LAS MAGNOLIAS 456",
        proyecto="PROJECT ALPHA",
        ubicacion="MAGDALENA, LIMA",
        fecha_recepcion=datetime(2026, 2, 5),
        emision_fisica=True,
        emision_digital=True,
        entregado_por="JUAN PEREZ",
        recibido_por="TECNICO LEM",
        observaciones="CILINDROS RECIBIDOS EN BUEN ESTADO.",
        muestras=muestras
    )
    
    output_path = 'backend/SURGICAL_VALIDATION.xlsx'
    data = logic.generar_excel_recepcion(recepcion)
    with open(output_path, 'wb') as f:
        f.write(data)
    
    # Analyze
    sheet_root, ss_root = get_xml_content(output_path)
    shared_strings = get_shared_strings(ss_root)
    
    print("\n--- INTERNAL ANCHOR MAP ---")
    # For debugging, we can't easily access 'anchors' from the class because it's localized in the method.
    # Let's perform a similar search here to see what we find.
    found_anchors = {}
    ns_sheet = sheet_root.nsmap.get(None, NAMESPACES['main'])
    for row in sheet_root.xpath('//main:row', namespaces={'main': ns_sheet}):
        r_num = int(row.get('r'))
        for cell in row.findall(f'{{{ns_sheet}}}c'):
            ref = cell.get('r')
            t = cell.get('t')
            v_node = cell.find(f'{{{ns_sheet}}}v')
            if t == 's' and v_node is not None:
                idx = int(v_node.text)
                val = shared_strings[idx].upper().strip()
                if val: found_anchors[val] = ref
    
    for k, v in found_anchors.items():
        if any(x in k for x in ["RECE", "CLIENTE", "NOTA", "OT", "FECHA"]):
            print(f"Anchor found: {k} -> {v}")

    print("\n--- SURGICAL VALIDATION RESULTS ---")
    
    # Check Header by Neighbor
    def get_neighbor(label_key):
        for k, v in found_anchors.items():
            if label_key.upper() in k:
                col = ''.join(c for c in v if c.isalpha())
                row = ''.join(c for c in v if c.isdigit())
                # Next col
                next_col = chr(ord(col) + 1)
                return f"{next_col}{row}"
        return None

    neigh_recep = get_neighbor("RECEPCIÓN N°:")
    print(f"CHECK Receipt Value (Col D?): {get_cell_value(sheet_root, shared_strings, 'D6')} (Expected 'SURGICAL-001')")
    print(f"CHECK Receipt Label (Col A?): {get_cell_value(sheet_root, shared_strings, 'A6')} (Expected Label)")

    print(f"CHECK Cliente (D10): {get_cell_value(sheet_root, shared_strings, 'D10')}")
    print(f"CHECK RUC (D12): {get_cell_value(sheet_root, shared_strings, 'D12')}")
    print(f"CHECK Contacto (D13): {get_cell_value(sheet_root, shared_strings, 'D13')}")
    print(f"CHECK Email (D14): {get_cell_value(sheet_root, shared_strings, 'D14')}")
    print(f"CHECK Telefono (H14): {get_cell_value(sheet_root, shared_strings, 'H14')}")
    print(f"CHECK Solicitante (D16): {get_cell_value(sheet_root, shared_strings, 'D16')}")
    print(f"CHECK Dom. Solicitante (D17): {get_cell_value(sheet_root, shared_strings, 'D17')}")
    print(f"CHECK Ubicacion (D19): {get_cell_value(sheet_root, shared_strings, 'D19')}")

    # Check Table Row 23 (First Item)
    print(f"CHECK [A23] Item: {get_cell_value(sheet_root, shared_strings, 'A23')}")
    print(f"CHECK [B23] Code LEM: {get_cell_value(sheet_root, shared_strings, 'B23')}")
    print(f"CHECK [D23] ID: {get_cell_value(sheet_root, shared_strings, 'D23')}")
    
    # Check Footer Displacement
    # Threshold is 18. Samples = 25. Shift = 7.
    # Original Nota was B43. 43 + 7 = 50.
    print(f"CHECK [D50] Observations: {get_cell_value(sheet_root, shared_strings, 'D50')}")
    
    # Checkbox Fisica was Row 45. 45 + 7 = 52.
    print(f"CHECK [A52] Fisica: {get_cell_value(sheet_root, shared_strings, 'A52')} (Expected 'X')")
    
    # Checkbox Digital was Row 47. 47 + 7 = 54.
    print(f"CHECK [A54] Digital: {get_cell_value(sheet_root, shared_strings, 'A54')} (Expected 'X')")
    
    # Entregado por (A49 original). 49 + 7 = 56.
    print(f"CHECK [A56] Signature Label: {get_cell_value(sheet_root, shared_strings, 'A56')}")
    # Value should be in A58? No, usually neighbor or 1 row down.
    # Let's check row 56 columns.
    print(f"CHECK [B56] Entregado por Name: {get_cell_value(sheet_root, shared_strings, 'B56')}")
    print(f"CHECK [G56] Recibido por Name: {get_cell_value(sheet_root, shared_strings, 'G56')}")

if __name__ == '__main__':
    verify_surgical()
