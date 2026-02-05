import zipfile
from lxml import etree

template_path = 'c:/Users/Lenovo/Documents/crmnew/recepcion-crm/templates/recepcion_template.xlsx'

NAMESPACES = {
    'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
}

def _num_to_col_letter(n: int) -> str:
    string = ""
    while n > 0:
        n, remainder = divmod(n - 1, 26)
        string = chr(65 + remainder) + string
    return string

def find_headers():
    with zipfile.ZipFile(template_path, 'r') as z:
        ss_content = z.read('xl/sharedStrings.xml')
        ss_root = etree.fromstring(ss_content)
        ns_ss = ss_root.nsmap.get(None, NAMESPACES['main'])
        shared_strings = []
        for si in ss_root.findall(f'{{{ns_ss}}}si'):
            t = si.find(f'{{{ns_ss}}}t')
            if t is not None: shared_strings.append(t.text)
            else: shared_strings.append(''.join([t.text or '' for t in si.findall(f'.//{{{ns_ss}}}t')]))

        sheet_content = z.read('xl/worksheets/sheet1.xml')
        sheet_root = etree.fromstring(sheet_content)
        ns_sheet = sheet_root.nsmap.get(None, NAMESPACES['main'])
        
        print("--- Row 22 columns A-K Dump ---")
        for row in sheet_root.xpath('//main:row[@r="22"]', namespaces={'main': ns_sheet}):
            for col_idx in range(1, 12):
                col_letter = _num_to_col_letter(col_idx)
                cell = row.find(f'{{{ns_sheet}}}c[@r="{col_letter}22"]')
                val = ""
                if cell is not None:
                    t = cell.get('t')
                    v_node = cell.find(f'{{{ns_sheet}}}v')
                    if t == 's' and v_node is not None:
                        idx = int(v_node.text)
                        val = shared_strings[idx] if idx < len(shared_strings) else "?"
                    elif v_node is not None: val = v_node.text
                print(f"{col_letter}22: '{val}'")

if __name__ == '__main__':
    find_headers()
