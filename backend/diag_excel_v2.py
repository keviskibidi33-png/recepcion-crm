import zipfile
from lxml import etree

def analyze_template():
    template_path = 'templates/recepcion_template.xlsx'
    with zipfile.ZipFile(template_path, 'r') as z:
        sheet_data = z.read('xl/worksheets/sheet1.xml')
        root = etree.fromstring(sheet_data)
        ns = {'n': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        
        print("=== MERGED CELLS ===")
        merge_cells = root.xpath('//n:mergeCell', namespaces=ns)
        for mc in merge_cells:
            print(f"Merge: {mc.get('ref')}")

        print("\n=== ROW 42-55 CONTENT & DATA TYPES ===")
        for r_num in range(42, 56):
            row = root.xpath(f'//n:row[@r="{r_num}"]', namespaces=ns)
            if not row: continue
            cells = row[0].xpath('n:c', namespaces=ns)
            row_info = []
            for c in cells:
                ref = c.get('r')
                # Check for shared string index 's' or inline string 'is'
                t_type = c.get('t')
                val = ""
                if t_type == 's':
                    v = c.find('n:v', namespaces=ns)
                    val = f"[SharedStringIdx:{v.text}]" if v is not None else "[Empty]"
                else:
                    t_el = c.find('.//n:t', namespaces=ns)
                    val = t_el.text if t_el is not None else "[Empty]"
                
                row_info.append(f"{ref}:{val}")
            print(f"Row {r_num}: {' | '.join(row_info)}")

if __name__ == "__main__":
    analyze_template()
