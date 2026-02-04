import zipfile
from lxml import etree
import re

def parse_ref(ref):
    m = re.match(r"([A-Z]+)([0-9]+)", ref)
    return m.group(1), int(m.group(2))

def surgical_dump():
    template_path = 'templates/recepcion_template.xlsx'
    with zipfile.ZipFile(template_path, 'r') as z:
        sheet_xml = z.read('xl/worksheets/sheet1.xml')
        root = etree.fromstring(sheet_xml)
        ns = {'n': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        
        shared_strings = []
        try:
            ss_xml = z.read('xl/sharedStrings.xml')
            ss_root = etree.fromstring(ss_xml)
            for si in ss_root.xpath('//n:si', namespaces=ns):
                ts = si.xpath('.//n:t/text()', namespaces=ns)
                shared_strings.append("".join(ts))
        except: pass

        # Map merged cells
        merged = {}
        for mc in root.xpath('//n:mergeCell', namespaces=ns):
            ref = mc.get('ref')
            start, end = ref.split(':')
            sc, sr = parse_ref(start)
            ec, er = parse_ref(end)
            for r in range(sr, er + 1):
                for c in range(ord(sc), ord(ec) + 1):
                    merged[f"{chr(c)}{r}"] = start

        def get_val(cell):
            t = cell.get('t')
            v = cell.find('n:v', namespaces=ns)
            if v is None:
                is_el = cell.find('n:is', namespaces=ns)
                if is_el is not None:
                    t_el = is_el.find('n:t', namespaces=ns)
                    return t_el.text if t_el is not None else ""
                return ""
            if t == 's':
                return shared_strings[int(v.text)] if int(v.text) < len(shared_strings) else f"ERR_IDX_{v.text}"
            return v.text

        print("--- SURGICAL DUMP ---")
        rows_to_scan = [21, 22, 23, 45, 46, 47, 48, 49, 50, 51]
        for r_num in rows_to_scan:
            row_el = root.xpath(f'//n:row[@r="{r_num}"]', namespaces=ns)
            if not row_el: 
                print(f"Row {r_num}: NOT FOUND")
                continue
            cells = []
            for c_el in row_el[0].xpath('n:c', namespaces=ns):
                ref = c_el.get('r')
                val = get_val(c_el)
                t = c_el.get('t')
                v_el = c_el.find('n:v', namespaces=ns)
                v_raw = v_el.text if v_el is not None else "NONE"
                m_root = merged.get(ref, "")
                cells.append(f"{ref}(t:{t},v:{v_raw},m:{m_root}):'{val}'")
            if cells:
                print(f"Row {r_num}: {' | '.join(cells)}")

if __name__ == "__main__":
    surgical_dump()
