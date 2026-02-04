import zipfile
from lxml import etree

def full_footer_dump():
    template_path = 'templates/recepcion_template.xlsx'
    with zipfile.ZipFile(template_path, 'r') as z:
        sheet_data = z.read('xl/worksheets/sheet1.xml')
        root = etree.fromstring(sheet_data)
        ns = {'n': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        
        try:
            ss_data = z.read('xl/sharedStrings.xml')
            ss_root = etree.fromstring(ss_data)
            # Find all <t> within <si>
            shared_strings = []
            for si in ss_root.xpath('//n:si', namespaces=ns):
                t_content = "".join(si.xpath('.//n:t/text()', namespaces=ns))
                shared_strings.append(t_content)
        except:
            shared_strings = []

        def get_val(cell):
            t = cell.get('t')
            v = cell.find('n:v', namespaces=ns)
            if v is None: return ""
            if t == 's':
                idx = int(v.text)
                return shared_strings[idx] if idx < len(shared_strings) else f"[ERR:{idx}]"
            return v.text

        print("--- GRANULAR FOOTER DUMP (Rows 40-55) ---")
        for r_num in range(40, 56):
            row = root.xpath(f'//n:row[@r="{r_num}"]', namespaces=ns)
            if not row:
                print(f"Row {r_num}: NOT FOUND")
                continue
            
            cells = row[0].xpath('n:c', namespaces=ns)
            row_items = []
            for c in cells:
                ref = c.get('r')
                val = get_val(c)
                row_items.append(f"{ref}:'{val}'")
            print(f"Row {r_num}: " + " | ".join(row_items))

if __name__ == "__main__":
    full_footer_dump()
