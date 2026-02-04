import zipfile
from lxml import etree

def analyze_footer():
    template_path = 'templates/recepcion_template.xlsx'
    with zipfile.ZipFile(template_path, 'r') as z:
        sheet_data = z.read('xl/worksheets/sheet1.xml')
        root = etree.fromstring(sheet_data)
        ns = {'n': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        
        # Shared Strings
        try:
            ss_data = z.read('xl/sharedStrings.xml')
            ss_root = etree.fromstring(ss_data)
            shared_strings = [ "".join(x.xpath('.//n:t/text()', namespaces=ns)) for x in ss_root.xpath('//n:si', namespaces=ns) ]
        except:
            shared_strings = []

        def get_val(cell):
            t = cell.get('t')
            v = cell.find('n:v', namespaces=ns)
            if v is None: return ""
            if t == 's':
                return shared_strings[int(v.text)]
            return v.text

        print("--- FOOTER CELL CONTENT ---")
        for r_num in [42, 43, 46, 47, 48, 49, 50, 51]:
            row = root.xpath(f'//n:row[@r="{r_num}"]', namespaces=ns)
            if not row: continue
            cells = row[0].xpath('n:c', namespaces=ns)
            for c in cells:
                ref = c.get('r')
                val = get_val(c)
                if val:
                    print(f"{ref}: {val}")

        print("\n--- MERGED CELLS (A40-K55) ---")
        merges = root.xpath('//n:mergeCell', namespaces=ns)
        for m in merges:
            ref = m.get('ref')
            # Check if it overlaps our footer area
            print(f"Merge: {ref}")

if __name__ == "__main__":
    analyze_footer()
