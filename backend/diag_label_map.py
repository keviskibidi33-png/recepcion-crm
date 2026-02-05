import zipfile
from lxml import etree

template_path = 'c:/Users/Lenovo/Documents/crmnew/recepcion-crm/templates/recepcion_template.xlsx'

NAMESPACES = {
    'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
}

def inspect_template():
    with zipfile.ZipFile(template_path, 'r') as z:
        # Load shared strings
        ss_content = z.read('xl/sharedStrings.xml')
        ss_root = etree.fromstring(ss_content)
        ns_ss = ss_root.nsmap.get(None, NAMESPACES['main'])
        
        shared_strings = []
        for si in ss_root.findall(f'{{{ns_ss}}}si'):
            t = si.find(f'{{{ns_ss}}}t')
            if t is not None:
                shared_strings.append(t.text)
            else:
                # Handle rich text
                r_texts = si.findall(f'.//{{{ns_ss}}}t')
                shared_strings.append(''.join([t.text or '' for t in r_texts]))
        
        # Load Sheet 1
        sheet_content = z.read('xl/worksheets/sheet1.xml')
        sheet_root = etree.fromstring(sheet_content)
        ns_sheet = sheet_root.nsmap.get(None, NAMESPACES['main'])
        
        print("--- All Shared Strings (Top 100) ---")
        for i, s in enumerate(shared_strings[:100]):
            print(f"{i}: '{s}'")
        
        # Load Sheet 1
        sheet_content = z.read('xl/worksheets/sheet1.xml')
        sheet_root = etree.fromstring(sheet_content)
        ns_sheet = sheet_root.nsmap.get(None, NAMESPACES['main'])
        
        print("\n--- Map of s='s' cells ---")
        for row in sheet_root.xpath('//main:row', namespaces={'main': ns_sheet}):
            row_num = row.get('r')
            cells_in_row = []
            for cell in row.findall(f'{{{ns_sheet}}}c'):
                cell_ref = cell.get('r')
                t = cell.get('t')
                v = cell.find(f'{{{ns_sheet}}}v')
                
                if t == 's' and v is not None:
                    idx = int(v.text)
                    val = shared_strings[idx] if idx < len(shared_strings) else "OUT_OF_BOUNDS"
                    cells_in_row.append(f"{cell_ref}:'{val}'")
            if cells_in_row:
                print(f"Row {row_num}: " + " | ".join(cells_in_row))

if __name__ == '__main__':
    inspect_template()
