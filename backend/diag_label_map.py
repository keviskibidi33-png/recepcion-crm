import zipfile
from lxml import etree

def create_label_map():
    template_path = 'templates/recepcion_template.xlsx'
    with zipfile.ZipFile(template_path, 'r') as z:
        sheet_data = z.read('xl/worksheets/sheet1.xml')
        root = etree.fromstring(sheet_data)
        ns = {'n': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        
        try:
            ss_data = z.read('xl/sharedStrings.xml')
            ss_root = etree.fromstring(ss_data)
            shared_strings = ["".join(si.xpath('.//n:t/text()', namespaces=ns)) for si in ss_root.xpath('//n:si', namespaces=ns)]
        except:
            shared_strings = []

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
                return shared_strings[int(v.text)]
            return v.text

        print("--- TEMPLATE LABEL MAP ---")
        for row in root.xpath('//n:row', namespaces=ns):
            r_num = row.get('r')
            labels = []
            for c in row.xpath('n:c', namespaces=ns):
                val = get_val(c)
                if val and len(val.strip()) > 1:
                    labels.append(f"{c.get('r')}:'{val}'")
            if labels:
                print(f"Row {r_num}: {' | '.join(labels)}")

if __name__ == "__main__":
    create_label_map()
