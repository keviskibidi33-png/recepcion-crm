import zipfile
from lxml import etree

NAMESPACES = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def get_shared_strings(z):
    ss_content = z.read('xl/sharedStrings.xml')
    ss_root = etree.fromstring(ss_content)
    ns = ss_root.nsmap.get(None, NAMESPACES['main'])
    strings = []
    for si in ss_root.findall(f'{{{ns}}}si'):
        t = si.find(f'{{{ns}}}t')
        if t is not None: strings.append((t.text or "").strip())
        else: strings.append(''.join([x.text or '' for x in si.findall(f'.//{{{ns}}}t')]).strip())
    return strings

def dump_header():
    file_path = 'backend/SURGICAL_VALIDATION.xlsx'
    with zipfile.ZipFile(file_path, 'r') as z:
        strings = get_shared_strings(z)
        sheet_content = z.read('xl/worksheets/sheet1.xml')
        sheet_root = etree.fromstring(sheet_content)
        ns = sheet_root.nsmap.get(None, NAMESPACES['main'])
        
        print(f"\n--- FINAL HEADER DUMP (Rows 6-20) ---")
        for r_num in range(6, 21):
            row_el = sheet_root.find(f'.//{{{ns}}}row[@r="{r_num}"]')
            if row_el is not None:
                line = f"Row {r_num:2}: "
                for col_idx in range(1, 12): # A-K
                    col_letter = ""
                    n = col_idx
                    while n > 0:
                        n, r = divmod(n - 1, 26)
                        col_letter = chr(65 + r) + col_letter
                    ref = f"{col_letter}{r_num}"
                    cell = row_el.find(f'{{{ns}}}c[@r="{ref}"]')
                    val = ""
                    if cell is not None:
                        t = cell.get('t')
                        v = cell.find(f'{{{ns}}}v')
                        if v is not None:
                            if t == 's':
                                idx = int(v.text)
                                val = strings[idx]
                            else: val = v.text
                    if val:
                        line += f"[{col_letter}:'{val}'] "
                print(line)

if __name__ == '__main__':
    dump_header()
