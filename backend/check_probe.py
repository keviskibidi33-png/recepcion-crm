import zipfile
from lxml import etree

def check_probe():
    with zipfile.ZipFile('probe_result.xlsx', 'r') as z:
        sheet_data = z.read('xl/worksheets/sheet1.xml')
        root = etree.fromstring(sheet_data)
        ns = {'n': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        
        ss_data = z.read('xl/sharedStrings.xml')
        ss_root = etree.fromstring(ss_data)
        shared_strings = ["".join(x.xpath('.//n:t/text()', namespaces=ns)) for x in ss_root.xpath('//n:si', namespaces=ns)]

        def get_val(cell):
            t = cell.get('t')
            v = cell.find('n:v', namespaces=ns)
            if v is None: return ""
            if t == 's':
                return shared_strings[int(v.text)]
            return v.text

        print("--- PROBE RESULT: ROW 43 ---")
        for c in root.xpath('//n:row[@r="43"]/n:c', namespaces=ns):
            print(f"{c.get('r')}: '{get_val(c)}'")

        print("\n--- PROBE RESULT: ROW 49 ---")
        for c in root.xpath('//n:row[@r="49"]/n:c', namespaces=ns):
            print(f"{c.get('r')}: '{get_val(c)}'")

        print("\n--- PROBE RESULT: ROW 51 ---")
        for c in root.xpath('//n:row[@r="51"]/n:c', namespaces=ns):
            print(f"{c.get('r')}: '{get_val(c)}'")

if __name__ == "__main__":
    check_probe()
