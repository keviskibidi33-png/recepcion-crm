import io
import os
import zipfile
import copy
from datetime import datetime, date
from typing import List, Dict, Any, Optional, Callable
from lxml import etree
from models import RecepcionMuestra, MuestraConcreto


NAMESPACES = {
    'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
}


def _parse_cell_ref(ref: str) -> tuple[str, int]:
    """Parse 'D5' -> ('D', 5)"""
    col = ''.join(c for c in ref if c.isalpha())
    row = int(''.join(c for c in ref if c.isdigit()))
    return col, row


def _col_letter_to_num(col: str) -> int:
    """A=1, B=2, ..., Z=26, AA=27"""
    num = 0
    for c in col.upper():
        num = num * 26 + (ord(c) - ord('A') + 1)
    return num


def _find_or_create_row(sheet_data: etree._Element, row_num: int, ns: str) -> etree._Element:
    """Encuentra o crea una fila"""
    for row in sheet_data.findall(f'{{{ns}}}row'):
        if row.get('r') == str(row_num):
            return row
    row = etree.SubElement(sheet_data, f'{{{ns}}}row')
    row.set('r', str(row_num))
    return row


def _set_cell_value_fast(row, ref, value, ns, is_number=False, get_string_idx=None):
    """Establece el valor de una celda de forma rápida recibiendo el elemento row"""
    c = row.find(f'{{{ns}}}c[@r="{ref}"]')
    if c is None:
        c = etree.SubElement(row, f'{{{ns}}}c')
        c.set('r', ref)
    
    # Preservar estilo si existe
    style = c.get('s')
    
    # Limpiar valor anterior
    for child in list(c):
        c.remove(child)
    
    if value is None or value == '':
        if 't' in c.attrib: del c.attrib['t']
        return

    if is_number:
        if 't' in c.attrib: del c.attrib['t']
        v = etree.SubElement(c, f'{{{ns}}}v')
        v.text = str(value)
    else:
        if get_string_idx:
            c.set('t', 's')
            v = etree.SubElement(c, f'{{{ns}}}v')
            v.text = str(get_string_idx(str(value)))
        else:
            c.set('t', 'inlineStr')
            is_elem = etree.SubElement(c, f'{{{ns}}}is')
            t = etree.SubElement(is_elem, f'{{{ns}}}t')
            t.text = str(value)
    
    if style:
        c.set('s', style)


def _shift_rows(sheet_data: etree._Element, from_row: int, shift: int, ns: str):
    """Desplaza filas >= from_row"""
    if shift <= 0:
        return
    
    rows = list(sheet_data.findall(f'{{{ns}}}row'))
    rows.sort(key=lambda r: int(r.get('r')), reverse=True)
    
    for row in rows:
        row_num = int(row.get('r'))
        if row_num >= from_row:
            new_num = row_num + shift
            row.set('r', str(new_num))
            for cell in row.findall(f'{{{ns}}}c'):
                old_ref = cell.get('r')
                col, _ = _parse_cell_ref(old_ref)
                cell.set('r', f'{col}{new_num}')


def _shift_merged_cells(root: etree._Element, from_row: int, shift: int, ns: str):
    """Actualiza las merged cells cuando se desplazan filas"""
    if shift <= 0:
        return
    
    merge_cells = root.find(f'.//{{{ns}}}mergeCells')
    if merge_cells is None:
        return
    
    for merge in merge_cells.findall(f'{{{ns}}}mergeCell'):
        ref = merge.get('ref')
        if ':' not in ref:
            continue
        
        start, end = ref.split(':')
        start_col, start_row = _parse_cell_ref(start)
        end_col, end_row = _parse_cell_ref(end)
        
        if start_row >= from_row:
            new_start_row = start_row + shift
            new_end_row = end_row + shift
            merge.set('ref', f'{start_col}{new_start_row}:{end_col}{new_end_row}')


def _duplicate_row_xml(sheet_data: etree._Element, source_row_num: int, target_row_num: int, ns: str) -> etree._Element:
    """Duplica una fila XML"""
    source_row = None
    for row in sheet_data.findall(f'{{{ns}}}row'):
        if row.get('r') == str(source_row_num):
            source_row = row
            break
    
    if source_row is None:
        return None
    
    new_row = copy.deepcopy(source_row)
    new_row.set('r', str(target_row_num))
    
    for cell in new_row.findall(f'{{{ns}}}c'):
        old_ref = cell.get('r')
        col, _ = _parse_cell_ref(old_ref)
        cell.set('r', f'{col}{target_row_num}')
    
    # Insertar en orden
    inserted = False
    for i, row in enumerate(sheet_data.findall(f'{{{ns}}}row')):
        if int(row.get('r')) > target_row_num:
            sheet_data.insert(list(sheet_data).index(row), new_row)
            inserted = True
            break
    
    if not inserted:
        sheet_data.append(new_row)
    
    return new_row


class ExcelLogic:
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    TEMPLATE_PATH = os.path.join(BASE_DIR, "templates", "recepcion_template.xlsx")
    FILA_INICIO_MUESTRAS = 23
    
    def generar_excel_recepcion(self, recepcion: RecepcionMuestra) -> bytes:
        """Generar Excel usando manipulación directa de XML (High Performance)"""
        if not os.path.exists(self.TEMPLATE_PATH):
            raise FileNotFoundError(f"Plantilla no encontrada: {self.TEMPLATE_PATH}")

        muestras = recepcion.muestras
        n_muestras = len(muestras)
        
        shared_strings = []
        shared_strings_map = {}
        ss_xml_original = None
        
        with zipfile.ZipFile(self.TEMPLATE_PATH, 'r') as z:
            if 'xl/sharedStrings.xml' in z.namelist():
                ss_xml_original = z.read('xl/sharedStrings.xml')
                ss_root = etree.fromstring(ss_xml_original)
                ss_ns = ss_root.nsmap.get(None, NAMESPACES['main'])
                
                for si in ss_root.findall(f'{{{ss_ns}}}si'):
                    si_t = si.find(f'{{{ss_ns}}}t')
                    if si_t is not None and si_t.text:
                        shared_strings.append(si_t.text)
                        shared_strings_map[si_t.text] = len(shared_strings) - 1
            
            sheet_data_xml = z.read('xl/worksheets/sheet1.xml')

        def get_string_idx(text: str) -> int:
            text = str(text) if text is not None else ""
            if text in shared_strings_map:
                return shared_strings_map[text]
            idx = len(shared_strings)
            shared_strings.append(text)
            shared_strings_map[text] = idx
            return idx

        def format_date(val):
            if not val: return ""
            if isinstance(val, str): return val
            if hasattr(val, 'strftime'): return val.strftime('%d/%m/%Y')
            return str(val)

        root = etree.fromstring(sheet_data_xml)
        ns = root.nsmap.get(None, NAMESPACES['main'])
        sheet_data = root.find(f'.//{{{ns}}}sheetData')
        
        # 1. Super-Robust Coordinate Detection (The "Fidelity Lock")
        header_anchors = {} # label -> row_num
        header_cols = {}
        footer_anchors = {}
        footer_cols = {}
        
        for row_el in sheet_data.findall(f'{{{ns}}}row'):
            r_num = int(row_el.get('r'))
            for cell_el in row_el.findall(f'{{{ns}}}c'):
                val = ""
                if cell_el.get('t') == 's':
                    v_el = cell_el.find(f'{{{ns}}}v')
                    if v_el is not None and v_el.text:
                        try:
                            s_idx = int(v_el.text)
                            if 0 <= s_idx < len(shared_strings):
                                val = shared_strings[s_idx].strip()
                        except: pass
                else:
                    is_el = cell_el.find(f'{{{ns}}}is')
                    if is_el is not None:
                        t_el = is_el.find(f'{{{ns}}}t')
                        if t_el is not None: val = (t_el.text or "").strip()
                
                if val:
                    c_name, _ = _parse_cell_ref(cell_el.get('r'))
                    if r_num < 30:
                        header_anchors[val] = r_num
                        header_cols[val] = c_name
                    elif r_num >= 40:
                        footer_anchors[val] = r_num
                        footer_cols[val] = c_name

        # 2. Hybrid Logic: Static vs Dynamic Shift
        threshold = 18
        fila_n_label = header_anchors.get("N°", 21)
        fila_inicio_muestras = fila_n_label + 2 # Row 23 is first data row
        fila_nota = footer_anchors.get("Nota:", 43)

        if n_muestras > threshold:
            extra_rows = n_muestras - threshold
            _shift_rows(sheet_data, fila_nota, extra_rows, ns)
            _shift_merged_cells(root, fila_nota, extra_rows, ns)
            # Duplicate first data row (usually 23)
            for i in range(threshold, n_muestras):
                _duplicate_row_xml(sheet_data, fila_inicio_muestras, fila_inicio_muestras + i, ns)

        # Refresh cache
        rows_cache = {r.get('r'): r for r in sheet_data.findall(f'{{{ns}}}row')}
        
        def write(c_name, r_num, val, is_num=False, is_footer=False):
            if is_footer and n_muestras > threshold:
                r_num += (n_muestras - threshold)
            ref = f"{c_name}{r_num}"
            row = rows_cache.get(str(r_num))
            if row is not None:
                _set_cell_value_fast(row, ref, val, ns, is_num, get_string_idx)

        # 3. Header (Fixed Mapping)
        write('D', 6, recepcion.numero_recepcion)
        write('D', 7, recepcion.numero_cotizacion or '-')
        write('J', 6, format_date(recepcion.fecha_recepcion))
        write('J', 7, recepcion.numero_ot)
        write('D', 10, recepcion.cliente)
        write('D', 11, recepcion.domicilio_legal)
        write('D', 12, recepcion.ruc)
        write('D', 13, recepcion.persona_contacto)
        write('D', 14, recepcion.email)
        write('H', 14, recepcion.telefono)
        write('D', 16, recepcion.solicitante)
        write('D', 17, recepcion.domicilio_solicitante)
        write('D', 18, recepcion.proyecto)
        write('D', 19, recepcion.ubicacion)

        # 4. Table (A-K Fixed)
        for idx, m in enumerate(muestras):
            r = fila_inicio_muestras + idx
            row = rows_cache.get(str(r))
            if row is not None:
                _set_cell_value_fast(row, f'A{r}', idx + 1, ns, True)
                _set_cell_value_fast(row, f'B{r}', getattr(m, 'codigo_muestra_lem', '') or '', ns, False, get_string_idx)
                _set_cell_value_fast(row, f'C{r}', getattr(m, 'codigo_muestra', '') or '', ns, False, get_string_idx)
                _set_cell_value_fast(row, f'E{r}', m.estructura, ns, False, get_string_idx)
                _set_cell_value_fast(row, f'F{r}', m.fc_kg_cm2, ns, True)
                _set_cell_value_fast(row, f'G{r}', m.fecha_moldeo, ns, False, get_string_idx)
                _set_cell_value_fast(row, f'H{r}', m.hora_moldeo, ns, False, get_string_idx)
                _set_cell_value_fast(row, f'I{r}', m.edad, ns, True)
                _set_cell_value_fast(row, f'J{r}', m.fecha_rotura, ns, False, get_string_idx)
                _set_cell_value_fast(row, f'K{r}', 'SI' if m.requiere_densidad else 'NO', ns, False, get_string_idx)

        # 5. Footer (Explicit Fixed Mapping)
        f_row = fila_nota
        write('D', f_row, recepcion.observaciones or "", is_footer=True)
        
        # Emissions (Boxes in A)
        if recepcion.emision_fisica: write('A', f_row + 2, "X", is_footer=True)
        if recepcion.emision_digital: write('A', f_row + 4, "X", is_footer=True) # Row 47 typically
        
        # Signatures
        # 49 is the signature line
        write('D', 49, recepcion.entregado_por or "", is_footer=True)
        write('I', 49, recepcion.recibido_por or "", is_footer=True)
        
        # Date and Code in Footer (Bottom text)
        write('B', 49, format_date(recepcion.fecha_recepcion), is_footer=True) # Date on signature line?
        write('G', 49, recepcion.numero_recepcion, is_footer=True) # Recepcion code in middle
        write('B', 51, recepcion.numero_ot, is_footer=True) # OT below

        # Output
        modified_sheet = etree.tostring(root, encoding='utf-8', xml_declaration=True)
        if ss_xml_original:
            ss_root_new = etree.fromstring(ss_xml_original)
            ss_ns = ss_root_new.nsmap.get(None, NAMESPACES['main'])
            for child in list(ss_root_new): ss_root_new.remove(child)
            for text in shared_strings:
                si = etree.SubElement(ss_root_new, f'{{{ss_ns}}}si')
                t_el = etree.SubElement(si, f'{{{ss_ns}}}t')
                t_el.text = text
            ss_root_new.set('count', str(len(shared_strings)))
            ss_root_new.set('uniqueCount', str(len(shared_strings)))
            modified_ss = etree.tostring(ss_root_new, encoding='utf-8', xml_declaration=True)
        else:
            modified_ss = None

        final_output = io.BytesIO()
        with zipfile.ZipFile(self.TEMPLATE_PATH, 'r') as z_in:
            with zipfile.ZipFile(final_output, 'w', compression=zipfile.ZIP_DEFLATED) as z_out:
                for item in z_in.namelist():
                    if item == 'xl/worksheets/sheet1.xml':
                        z_out.writestr(item, modified_sheet)
                    elif item == 'xl/sharedStrings.xml' and modified_ss:
                        z_out.writestr(item, modified_ss)
                    else:
                        z_out.writestr(item, z_in.read(item))
        final_output.seek(0)
        return final_output.getvalue()
